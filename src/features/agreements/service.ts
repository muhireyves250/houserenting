import "server-only";
import { audit } from "@/features/audit/service";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { canStaff } from "@/lib/roles";

type Actor = { id: string; role?: string | null; staffAreas?: readonly string[] | null };
type Client = Prisma.TransactionClient | typeof db;
export type Subject = "PLACE" | "RESTAURANT" | "LAUNDRY";
export type Agreement = { percentBps: number | null; fixedFee: number | null };

/** Most VIIPA may take (in %). */
export const MAX_PERCENT = 50;

/** The agreement in force for a place, restaurant or laundry at a moment (the latest that had started), if any. */
export async function agreementAt(subject: Subject, subjectId: string, at: Date = new Date(), client: Client = db): Promise<Agreement | null> {
  return client.commissionAgreement.findFirst({
    where: { subject, subjectId, effectiveFrom: { lte: at } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    select: { percentBps: true, fixedFee: true },
  });
}

/** VIIPA's commission on an amount under an agreement (a fixed fee never exceeds the amount); null = no agreement. */
export function commissionUnder(agreement: Agreement | null, amount: number): number | null {
  if (!agreement) return null;
  if (agreement.fixedFee !== null) return Math.min(agreement.fixedFee, Math.max(0, amount));
  return Math.round((amount * (agreement.percentBps ?? 0)) / 10_000);
}

export type AgreementResult = { ok: true } | { ok: false; error: "notAllowed" | "invalid" | "notFound" };

/**
 * Records a new agreement (a percentage or a fixed fee) starting on a date (today if none). Earlier agreements stay as
 * the history; nothing already paid changes. Staff handling money; logged with who made it.
 */
export async function setAgreement(actor: Actor, subject: Subject, subjectId: string, input: { percent?: number | null; fixedFee?: number | null; effectiveFrom?: string | null; note?: string | null }, now: Date = new Date()): Promise<AgreementResult> {
  if (!canStaff(actor, "money")) return { ok: false, error: "notAllowed" };
  const percent = input.percent ?? null;
  const fixedFee = input.fixedFee ?? null;
  if ((percent === null) === (fixedFee === null)) return { ok: false, error: "invalid" };
  if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > MAX_PERCENT)) return { ok: false, error: "invalid" };
  if (fixedFee !== null && (!Number.isInteger(fixedFee) || fixedFee < 0 || fixedFee > 10_000_000)) return { ok: false, error: "invalid" };
  const from = input.effectiveFrom ? new Date(`${input.effectiveFrom}T00:00:00+02:00`) : now;
  if (Number.isNaN(from.getTime())) return { ok: false, error: "invalid" };
  const exists = subject === "RESTAURANT" ? await db.restaurant.findUnique({ where: { id: subjectId }, select: { id: true } }) : await db.listing.findUnique({ where: { id: subjectId }, select: { id: true } });
  if (!exists) return { ok: false, error: "notFound" };
  const percentBps = percent === null ? null : Math.round(percent * 100);
  await db.$transaction(async (tx) => {
    const created = await tx.commissionAgreement.create({ data: { subject, subjectId, percentBps, fixedFee, effectiveFrom: from, note: input.note?.trim().slice(0, 300) || null, createdById: actor.id } });
    // The place's current rate follows its agreement once it has started (bookings read it).
    if (subject === "PLACE" && from <= now) await tx.listing.update({ where: { id: subjectId }, data: { commissionBps: percentBps } });
    await audit(tx, { actorId: actor.id, action: "commission.agreement", entityType: subject.toLowerCase(), entityId: subjectId, data: { agreement: created.id, percentBps, fixedFee, effectiveFrom: from.toISOString() } });
  });
  return { ok: true };
}

/** Every agreement for one place, restaurant or laundry, newest first, with who made it. */
export async function agreementHistory(subject: Subject, subjectId: string) {
  const rows = await db.commissionAgreement.findMany({ where: { subject, subjectId }, orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }] });
  const names = new Map((await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.createdById))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  return rows.map((r) => ({ ...r, by: names.get(r.createdById) ?? "—" }));
}

/** What the agreement editor shows: the agreement in force now (as text) and the history (dates as YYYY-MM-DD). */
export async function agreementPanel(subject: Subject, subjectId: string, now: Date = new Date()) {
  const [current, history] = await Promise.all([agreementAt(subject, subjectId, now), agreementHistory(subject, subjectId)]);
  return {
    current: current ? (current.fixedFee !== null ? `RWF ${current.fixedFee.toLocaleString("en")}` : `${(current.percentBps ?? 0) / 100}%`) : null,
    history: history.map((r) => ({ id: r.id, percentBps: r.percentBps, fixedFee: r.fixedFee, effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10), note: r.note, by: r.by })),
  };
}
