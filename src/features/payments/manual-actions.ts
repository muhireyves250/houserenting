"use server";

import { revalidatePath } from "next/cache";
import { isBookingReference } from "@/features/bookings/reference";
import { getCurrentUser } from "@/lib/session";
import { claimPayment, confirmPaymentByHand, rejectPaymentClaim, type ClaimResult, type ConfirmResult } from "./manual";

const refresh = () => revalidatePath("/[locale]", "layout");

export async function claimPaymentAction(reference: string, transactionId: string): Promise<ClaimResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!isBookingReference(reference) || typeof transactionId !== "string") return { ok: false, error: "transaction" };
  const result = await claimPayment(user.id, reference, transactionId);
  if (result.ok) refresh();
  return result;
}

export async function confirmPaymentAction(reference: string, transactionId: string, amount: number): Promise<ConfirmResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!isBookingReference(reference) || typeof transactionId !== "string" || typeof amount !== "number") return { ok: false, error: "transaction" };
  const result = await confirmPaymentByHand(user, reference, { transactionId, amount });
  if (result.ok) refresh();
  return result;
}

export async function rejectPaymentAction(reference: string, reason: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !isBookingReference(reference) || typeof reason !== "string") return { ok: false };
  const ok = await rejectPaymentClaim(user, reference, reason);
  if (ok) refresh();
  return { ok };
}
