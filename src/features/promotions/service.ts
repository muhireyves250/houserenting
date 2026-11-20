import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/features/audit/service";
import { db } from "@/lib/db";
import { normalizeCode, promoDiscount } from "./discount";

export const promoInput = z
  .object({
    code: z.string().transform(normalizeCode).pipe(z.string().regex(/^[A-Z0-9_-]{3,30}$/)),
    description: z.string().trim().max(200).default(""),
    percentOff: z.number().int().min(1).max(100).nullable(),
    amountOff: z.number().int().min(1).max(100_000_000).nullable(),
    minSubtotal: z.number().int().min(1).nullable(),
    startsAt: z.coerce.date().nullable(),
    endsAt: z.coerce.date().nullable(),
    maxUses: z.number().int().min(1).nullable(),
    fundedBy: z.enum(["PLATFORM", "HOST"]),
    /** Optional: the promoter this code is for (staff codes have none). */
    promoterId: z.string().min(1).max(64).nullable().optional(),
    /** The promoter's share of each booking with this code, in % (e.g. 5 or 7.5). */
    promoterPercent: z.number().min(0).max(50).nullable().optional(),
  })
  .refine((p) => !p.promoterId || (p.promoterPercent ?? 0) > 0, { path: ["promoterPercent"], message: "needsShare" })
  .refine((p) => p.percentOff !== null || p.amountOff !== null, { path: ["percentOff"], message: "needsDiscount" })
  .refine((p) => !p.startsAt || !p.endsAt || p.endsAt > p.startsAt, { path: ["endsAt"], message: "endBeforeStart" });

export type PromoInput = z.input<typeof promoInput>;

export async function createPromo(adminId: string, raw: PromoInput): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const parsed = promoInput.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.join(".") || "form"] ??= issue.message;
    return { ok: false, errors };
  }
  // A promoter must exist and be active to get a code.
  if (parsed.data.promoterId) {
    const promoter = await db.promoter.findUnique({ where: { id: parsed.data.promoterId }, select: { status: true } });
    if (!promoter || promoter.status !== "ACTIVE") return { ok: false, errors: { promoterId: "field" } };
  }
  try {
    await db.$transaction(async (tx) => {
      const { promoterPercent, ...fields } = parsed.data;
      const promo = await tx.promoCode.create({
        data: { ...fields, promoterId: fields.promoterId ?? null, promoterBps: fields.promoterId && promoterPercent ? Math.round(promoterPercent * 100) : null, createdById: adminId },
      });
      await audit(tx, { actorId: adminId, action: "promo.create", entityType: "promo", entityId: promo.id, data: { code: promo.code } });
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return { ok: false, errors: { code: "taken" } };
    throw error;
  }
  return { ok: true };
}

export async function setPromoActive(adminId: string, id: string, active: boolean): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.promoCode.updateMany({ where: { id, active: !active }, data: { active } });
    if (count === 1) await audit(tx, { actorId: adminId, action: active ? "promo.enable" : "promo.disable", entityType: "promo", entityId: id });
    return count === 1;
  });
}

/** Sets (or clears) the promoter's share, in %, on a promo code given to a promoter. Logged. */
export async function setPromoShare(adminId: string, id: string, percent: number | null): Promise<boolean> {
  if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 50)) return false;
  const promo = await db.promoCode.findUnique({ where: { id }, select: { promoterId: true, promoterBps: true } });
  if (!promo?.promoterId) return false;
  const bps = percent === null ? null : Math.round(percent * 100);
  await db.$transaction(async (tx) => {
    await tx.promoCode.update({ where: { id }, data: { promoterBps: bps } });
    await audit(tx, { actorId: adminId, action: "promo.share", entityType: "promo", entityId: id, data: { from: promo.promoterBps, to: bps } });
  });
  return true;
}

/** Deletes a promo code nobody has used (used ones stay on record: turn them off instead). Logged. */
export async function deletePromo(adminId: string, id: string): Promise<{ ok: true } | { ok: false; error: "notFound" | "used" }> {
  const promo = await db.promoCode.findUnique({ where: { id }, select: { code: true, usedCount: true, _count: { select: { bookings: true } } } });
  if (!promo) return { ok: false, error: "notFound" };
  if (promo.usedCount > 0 || promo._count.bookings > 0) return { ok: false, error: "used" };
  await db.$transaction(async (tx) => {
    await audit(tx, { actorId: adminId, action: "promo.delete", entityType: "promo", entityId: id, data: { code: promo.code } });
    await tx.promoCode.delete({ where: { id } });
  });
  return { ok: true };
}

export function listPromos() {
  return db.promoCode.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { promoter: { select: { code: true, user: { select: { name: true } } } } } });
}

export type PromoCheck =
  | { ok: true; id: string; code: string; discount: number; fundedBy: "PLATFORM" | "HOST" }
  | { ok: false; error: "unknown" | "expired" | "usedUp" | "minimum" };

/** Whether a code works for this price right now (no use is counted). */
export async function checkPromo(client: Prisma.TransactionClient | typeof db, raw: string, subtotal: number, now: Date = new Date()): Promise<PromoCheck> {
  const promo = await client.promoCode.findUnique({ where: { code: normalizeCode(raw) } });
  if (!promo || !promo.active) return { ok: false, error: "unknown" };
  if ((promo.startsAt && promo.startsAt > now) || (promo.endsAt && promo.endsAt <= now)) return { ok: false, error: "expired" };
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) return { ok: false, error: "usedUp" };
  const discount = promoDiscount(subtotal, promo);
  if (discount === 0) return { ok: false, error: "minimum" };
  return { ok: true, id: promo.id, code: promo.code, discount, fundedBy: promo.fundedBy };
}

/** Counts one use, only while uses remain (safe when many guests use the last one at once). */
export async function claimPromoUse(tx: Prisma.TransactionClient, id: string): Promise<boolean> {
  const rows = await tx.$executeRaw`UPDATE "promoCode" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${id} AND "active" AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`;
  return rows === 1;
}
