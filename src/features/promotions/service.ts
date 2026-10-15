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
  })
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
  try {
    await db.$transaction(async (tx) => {
      const promo = await tx.promoCode.create({ data: { ...parsed.data, createdById: adminId } });
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

export function listPromos() {
  return db.promoCode.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
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
