import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/features/audit/service";
import { newReference } from "@/features/bookings/reference";
import { notify, notifyAdmins } from "@/features/notifications/service";
import { todayISO } from "@/features/search/date-range";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { z } from "zod";
import { isPromoterCode } from "./cookie";
import { promoterRewardFor, REPEAT_GUEST_DAYS } from "./rules";

type Actor = { id: string; role?: string | null };

export const promoterInput = z
  .object({
    about: z.string().trim().max(500).default(""),
    payoutMethod: z.enum(["MOBILE_MONEY", "BANK"]),
    payoutName: z.string().trim().min(2).max(100),
    payoutNumber: z.string().trim().min(6).max(40),
    bankName: z.string().trim().max(80).nullable().default(null),
  })
  .refine((v) => v.payoutMethod !== "BANK" || (v.bankName && v.bankName.length >= 2), { path: ["bankName"], message: "required" });

export type PromoterInput = z.input<typeof promoterInput>;

const errorsOf = (issues: { path: PropertyKey[]; message: string }[]) => Object.fromEntries(issues.map((i) => [i.path.join(".") || "form", i.message]));

/** Apply to become a promoter (staff approve), or update payout details (any change needs no re-approval but is logged). */
export async function savePromoter(userId: string, raw: PromoterInput): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const parsed = promoterInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: errorsOf(parsed.error.issues) };
  const existing = await db.promoter.findUnique({ where: { userId }, select: { id: true } });
  if (existing) {
    await db.promoter.update({ where: { userId }, data: parsed.data });
    await audit(db, { actorId: userId, action: "promoter.update", entityType: "promoter", entityId: existing.id });
    return { ok: true };
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await db.promoter.create({ data: { userId, code: newReference("P"), ...parsed.data } });
      await audit(db, { actorId: userId, action: "promoter.apply", entityType: "promoter", entityId: created.id });
      await notifyAdmins(db, "promoterApplied", {}, "/admin/promoters");
      return { ok: true };
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  return { ok: false, errors: { form: "failed" } };
}

export async function setPromoterStatus(actor: Actor, promoterId: string, status: "ACTIVE" | "SUSPENDED", reason = "", now: Date = new Date()): Promise<boolean> {
  if (!isAdmin(actor)) return false;
  const why = reason.trim().slice(0, 300);
  if (status === "SUSPENDED" && !why) return false;
  const p = await db.promoter.findUnique({ where: { id: promoterId }, select: { status: true, userId: true } });
  if (!p || p.status === status) return false;
  await db.$transaction(async (tx) => {
    await tx.promoter.update({ where: { id: promoterId }, data: { status, statusReason: why || null, decidedById: actor.id, decidedAt: now } });
    await audit(tx, { actorId: actor.id, action: status === "ACTIVE" ? "promoter.approve" : "promoter.suspend", entityType: "promoter", entityId: promoterId, data: { from: p.status, to: status, ...(why ? { reason: why } : {}) } });
    await notify(tx, p.userId, "promoterStatus", { status, reason: why }, "/promote");
  });
  return true;
}

/** Counts a QR visit (once per visitor per day) and says whether the link belongs to an active promoter. */
export async function recordVisit(code: string, visitor: string, now: Date = new Date()): Promise<boolean> {
  if (!isPromoterCode(code)) return false;
  const p = await db.promoter.findUnique({ where: { code }, select: { id: true, status: true } });
  if (!p || p.status !== "ACTIVE") return false;
  const day = new Date(`${todayISO(now)}T00:00:00Z`);
  await db.promoterVisit.upsert({ where: { promoterId_day_visitor: { promoterId: p.id, day, visitor } }, create: { promoterId: p.id, day, visitor }, update: {} });
  return true;
}

/** Links a new booking to the promoter from the visitor's QR cookie: an active promoter, never the guest themselves. */
export async function attributeBooking(reference: string, guestId: string, code: string | undefined): Promise<void> {
  if (!code || !isPromoterCode(code)) return;
  const p = await db.promoter.findUnique({ where: { code }, select: { id: true, userId: true, status: true } });
  if (!p || p.status !== "ACTIVE" || p.userId === guestId) return;
  await db.booking.updateMany({ where: { reference, guestId, promoterId: null }, data: { promoterId: p.id } });
}

/**
 * When a stay the promoter brought finishes: one reward (configurable) waits for staff approval.
 * No reward for their own stays, for suspended promoters, or for the same guest twice within 30 days.
 */
export async function maybePromoterReward(tx: Prisma.TransactionClient, bookingId: string, now: Date = new Date()): Promise<void> {
  const config = await tx.platformConfig.findUnique({ where: { id: 1 }, select: { promoterEnabled: true, promoterRewardFixed: true, promoterRewardBps: true } });
  if (!config?.promoterEnabled) return;
  const b = await tx.booking.findUnique({ where: { id: bookingId }, select: { guestId: true, subtotal: true, promoterId: true, promoter: { select: { status: true, userId: true } } } });
  if (!b?.promoterId || !b.promoter || b.promoter.status !== "ACTIVE" || b.promoter.userId === b.guestId) return;
  const since = new Date(now.getTime() - REPEAT_GUEST_DAYS * 86_400_000);
  const recent = await tx.promoterReward.count({ where: { promoterId: b.promoterId, guestId: b.guestId, createdAt: { gte: since } } });
  if (recent > 0) return;
  const amount = promoterRewardFor(config, b.subtotal);
  if (amount <= 0) return;
  await tx.promoterReward.create({ data: { promoterId: b.promoterId, bookingId, guestId: b.guestId, amount } });
  await notifyAdmins(tx, "rewardToCheck", {}, "/admin/promoters");
}

/** Staff approve or void a reward; approved ones are paid out separately (and written to the ledger). */
export async function decidePromoterReward(actor: Actor, rewardId: string, approve: boolean, now: Date = new Date()): Promise<boolean> {
  if (!isAdmin(actor)) return false;
  return db.$transaction(async (tx) => {
    const r = await tx.promoterReward.findFirst({ where: { id: rewardId, status: "PENDING" }, select: { promoter: { select: { userId: true } }, amount: true } });
    if (!r) return false;
    await tx.promoterReward.update({ where: { id: rewardId }, data: { status: approve ? "APPROVED" : "VOID", decidedById: actor.id, decidedAt: now } });
    await audit(tx, { actorId: actor.id, action: approve ? "promoter.rewardApprove" : "promoter.rewardVoid", entityType: "promoterReward", entityId: rewardId, data: { amount: r.amount } });
    if (approve) await notify(tx, r.promoter.userId, "rewardApproved", { amount: r.amount }, "/promote");
    return true;
  });
}

export async function markPromoterRewardPaid(actor: Actor, rewardId: string, now: Date = new Date()): Promise<boolean> {
  if (!isAdmin(actor)) return false;
  return db.$transaction(async (tx) => {
    const r = await tx.promoterReward.findFirst({ where: { id: rewardId, status: "APPROVED", paidAt: null }, select: { amount: true, bookingId: true, promoter: { select: { userId: true } } } });
    if (!r) return false;
    await tx.promoterReward.update({ where: { id: rewardId }, data: { paidAt: now } });
    await tx.ledgerEntry.create({ data: { kind: "PROMOTER_REWARD", amount: r.amount, bookingId: r.bookingId, note: `promoter ${r.promoter.userId}` } });
    await audit(tx, { actorId: actor.id, action: "promoter.rewardPaid", entityType: "promoterReward", entityId: rewardId, data: { amount: r.amount } });
    await notify(tx, r.promoter.userId, "payoutRecorded", { amount: r.amount, reference: rewardId.slice(-6).toUpperCase() }, "/promote");
    return true;
  });
}

/** The promoter's own page: status, link and what their visitors turned into. */
export async function promoterDashboard(userId: string, now: Date = new Date()) {
  const p = await db.promoter.findUnique({ where: { userId } });
  if (!p) return null;
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [visits30, bookings, rewards] = await Promise.all([
    db.promoterVisit.count({ where: { promoterId: p.id, createdAt: { gte: since } } }),
    db.booking.count({ where: { promoterId: p.id, status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED"] } } }),
    db.promoterReward.findMany({ where: { promoterId: p.id }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, amount: true, status: true, paidAt: true, createdAt: true } }),
  ]);
  const sum = (f: (r: (typeof rewards)[number]) => boolean) => rewards.filter(f).reduce((a, r) => a + r.amount, 0);
  return {
    promoter: p,
    visits30,
    bookings,
    rewards,
    pending: sum((r) => r.status === "PENDING"),
    approved: sum((r) => r.status === "APPROVED" && !r.paidAt),
    paid: sum((r) => r.paidAt !== null),
  };
}

export function allPromoters() {
  return db.promoter.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 300,
    include: { user: { select: { id: true, name: true, email: true } }, _count: { select: { visits: true, bookings: true, rewards: true } } },
  });
}

export function openPromoterRewards() {
  return db.promoterReward.findMany({
    where: { OR: [{ status: "PENDING" }, { status: "APPROVED", paidAt: null }] },
    orderBy: { createdAt: "asc" },
    include: { promoter: { select: { code: true, payoutMethod: true, payoutName: true, payoutNumber: true, bankName: true, user: { select: { name: true } } } }, booking: { select: { reference: true } } },
  });
}

export type StaffPromoterResult = { ok: true } | { ok: false; error: "notAllowed" | "noAccount" | "already" | "notFound" | "hasRewards" } | { ok: false; errors: Record<string, string> };

/** Staff add a promoter for someone with an account (by email): active straight away, and told. */
export async function staffAddPromoter(actor: Actor, email: string, raw: PromoterInput): Promise<StaffPromoterResult> {
  if (!isAdmin(actor)) return { ok: false, error: "notAllowed" };
  const parsed = promoterInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: errorsOf(parsed.error.issues) };
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true, promoter: { select: { id: true } } } });
  if (!user) return { ok: false, error: "noAccount" };
  if (user.promoter) return { ok: false, error: "already" };
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db.$transaction(async (tx) => {
        const created = await tx.promoter.create({ data: { userId: user.id, code: newReference("P"), status: "ACTIVE", decidedById: actor.id, decidedAt: new Date(), ...parsed.data } });
        await audit(tx, { actorId: actor.id, action: "promoter.add", entityType: "promoter", entityId: created.id });
        await notify(tx, user.id, "promoterStatus", { status: "ACTIVE", reason: "" }, "/promote");
      });
      return { ok: true };
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  return { ok: false, error: "notAllowed" };
}

/** Staff change a promoter's details (where they promote, where rewards are paid). Logged. */
export async function staffEditPromoter(actor: Actor, promoterId: string, raw: PromoterInput): Promise<StaffPromoterResult> {
  if (!isAdmin(actor)) return { ok: false, error: "notAllowed" };
  const parsed = promoterInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: errorsOf(parsed.error.issues) };
  const { count } = await db.promoter.updateMany({ where: { id: promoterId }, data: parsed.data });
  if (count !== 1) return { ok: false, error: "notFound" };
  await audit(db, { actorId: actor.id, action: "promoter.update", entityType: "promoter", entityId: promoterId });
  return { ok: true };
}

/** Staff delete a promoter who has no rewards (their history stays otherwise: suspend instead). */
export async function deletePromoter(actor: Actor, promoterId: string): Promise<StaffPromoterResult> {
  if (!isAdmin(actor)) return { ok: false, error: "notAllowed" };
  const p = await db.promoter.findUnique({ where: { id: promoterId }, select: { code: true, _count: { select: { rewards: true } } } });
  if (!p) return { ok: false, error: "notFound" };
  if (p._count.rewards > 0) return { ok: false, error: "hasRewards" };
  await db.$transaction(async (tx) => {
    await tx.promoter.delete({ where: { id: promoterId } });
    await audit(tx, { actorId: actor.id, action: "promoter.delete", entityType: "promoter", entityId: promoterId, data: { code: p.code } });
  });
  return { ok: true };
}
