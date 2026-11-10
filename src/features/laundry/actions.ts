"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { LAUNDRY_STATUSES } from "./rules";
import {
  cancelMyLaundry,
  claimLaundryPayment,
  confirmLaundryPayment,
  moveLaundry,
  requestLaundry,
  type ClaimLaundryResult,
  type ConfirmLaundryResult,
  type MoveLaundryResult,
  type RequestLaundryResult,
} from "./service";

const ref = z.string().min(1).max(40);

function refresh() {
  revalidatePath("/[locale]/my-stay", "page");
  revalidatePath("/[locale]/admin/laundry", "page");
}

export async function requestLaundryAction(bookingReference: string, note: string): Promise<RequestLaundryResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!ref.safeParse(bookingReference).success) return { ok: false, error: "noStay" };
  const result = await requestLaundry(user.id, bookingReference, String(note ?? ""));
  refresh();
  return result;
}

export async function cancelMyLaundryAction(reference: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !ref.safeParse(reference).success) return false;
  const done = await cancelMyLaundry(user.id, reference);
  refresh();
  return done;
}

export async function claimLaundryPaymentAction(reference: string, transactionId: string): Promise<ClaimLaundryResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!ref.safeParse(reference).success) return { ok: false, error: "notFound" };
  const result = await claimLaundryPayment(user.id, reference, String(transactionId ?? ""));
  refresh();
  return result;
}

export async function moveLaundryAction(reference: string, to: string, input: { kg?: string; reason?: string }): Promise<MoveLaundryResult> {
  const user = await getCurrentUser();
  const step = z.enum(LAUNDRY_STATUSES).safeParse(to);
  if (!user) return { ok: false, error: "notAllowed" };
  if (!ref.safeParse(reference).success || !step.success) return { ok: false, error: "notFound" };
  const result = await moveLaundry(user, reference, step.data, { kg: String(input?.kg ?? ""), reason: String(input?.reason ?? "") });
  refresh();
  return result;
}

export async function confirmLaundryPaymentAction(reference: string, transactionId: string): Promise<ConfirmLaundryResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "notAllowed" };
  if (!ref.safeParse(reference).success) return { ok: false, error: "notFound" };
  const result = await confirmLaundryPayment(user, reference, String(transactionId ?? "") || undefined);
  refresh();
  return result;
}
