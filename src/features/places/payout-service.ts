import "server-only";
import { z } from "zod";
import { audit } from "@/features/audit/service";
import { db } from "@/lib/db";

export const payoutInput = z
  .object({
    method: z.enum(["MOBILE_MONEY", "BANK"]),
    accountName: z.string().trim().min(2).max(100),
    accountNumber: z.string().trim().min(5).max(40),
    bankName: z.string().trim().max(80).nullable().optional(),
  })
  .refine((v) => v.method !== "BANK" || Boolean(v.bankName), { path: ["bankName"], message: "bankRequired" });

export type PayoutInput = z.input<typeof payoutInput>;

/** Masked for display ("•••• 4567"); the full number is only shown to staff verifying it. */
export const maskAccount = (n: string) => `•••• ${n.slice(-4)}`;

export function payoutAccountOf(userId: string) {
  return db.payoutAccount.findUnique({ where: { userId } });
}

/** Saves an owner's payout details. Any change needs staff to verify again before the owner's places go live. */
export async function savePayoutAccount(userId: string, raw: PayoutInput): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const parsed = payoutInput.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.join(".") || "form"] ??= issue.message;
    return { ok: false, errors };
  }
  const data = { ...parsed.data, bankName: parsed.data.method === "BANK" ? (parsed.data.bankName ?? null) : null, verifiedAt: null, verifiedById: null };
  await db.$transaction(async (tx) => {
    await tx.payoutAccount.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    await audit(tx, { actorId: userId, action: "payout.update", entityType: "user", entityId: userId, data: { method: data.method } });
  });
  return { ok: true };
}

export async function verifyPayoutAccount(adminId: string, userId: string, now: Date = new Date()): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.payoutAccount.updateMany({ where: { userId, verifiedAt: null }, data: { verifiedAt: now, verifiedById: adminId } });
    if (count === 1) await audit(tx, { actorId: adminId, action: "payout.verify", entityType: "user", entityId: userId });
    return count === 1;
  });
}
