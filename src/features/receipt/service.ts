import "server-only";
import { cache } from "react";
import { audit } from "@/features/audit/service";
import { db } from "@/lib/db";
import { canStaff } from "@/lib/roles";
import { receiptInput, type ReceiptDetails, type ReceiptInput } from "./validation";

/** The business details printed on guests' receipts (empty fields are left off). */
export const getReceiptDetails = cache(async (): Promise<ReceiptDetails> => {
  const row = await db.platformConfig.findUnique({
    where: { id: 1 },
    select: { receiptBusinessName: true, receiptAddress: true, receiptPhone: true, receiptEmail: true, receiptTin: true, receiptFooter: true },
  });
  return {
    businessName: row?.receiptBusinessName ?? null,
    address: row?.receiptAddress ?? null,
    phone: row?.receiptPhone ?? null,
    email: row?.receiptEmail ?? null,
    tin: row?.receiptTin ?? null,
    footer: row?.receiptFooter ?? null,
  };
});

export type SaveReceiptResult = { ok: true } | { ok: false; errors: Record<string, string> } | { ok: false; error: "notAllowed" };

/** Staff change what receipts show. Logged. */
export async function saveReceiptDetails(actor: { id: string; role?: string | null }, raw: ReceiptInput): Promise<SaveReceiptResult> {
  if (!canStaff(actor, "money")) return { ok: false, error: "notAllowed" };
  const parsed = receiptInput.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { ok: false, errors };
  }
  const d = parsed.data;
  const data = { receiptBusinessName: d.businessName, receiptAddress: d.address, receiptPhone: d.phone, receiptEmail: d.email, receiptTin: d.tin, receiptFooter: d.footer, updatedById: actor.id };
  await db.$transaction(async (tx) => {
    await tx.platformConfig.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
    await audit(tx, { actorId: actor.id, action: "settings.receipt", entityType: "settings", entityId: "receipt" });
  });
  return { ok: true };
}

/**
 * The seller on a guest's EBM invoice for a place: VIIPA when it manages the place, otherwise the owner (their TIN from
 * their payout details). Null when that TIN isn't set yet.
 */
export async function sellerFor(listing: { operator: string; hostId: string }): Promise<{ name: string | null; tin: string } | null> {
  if (listing.operator === "VIIPA") {
    const viipa = await getReceiptDetails();
    return viipa.tin ? { name: viipa.businessName ?? "VIIPA", tin: viipa.tin } : null;
  }
  const owner = await db.user.findUnique({ where: { id: listing.hostId }, select: { name: true, payoutAccount: { select: { tin: true, accountName: true } } } });
  const tin = owner?.payoutAccount?.tin;
  return tin ? { name: owner?.name ?? owner?.payoutAccount?.accountName ?? null, tin } : null;
}
