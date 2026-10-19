"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isBookingReference } from "@/features/bookings/reference";
import { staffMoveBooking } from "@/features/bookings/service";
import { canOn } from "@/features/places/access";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";
import { STAY_REQUEST_KINDS } from "./rules";
import {
  decideStayRequest,
  markNoShow,
  reportStayIssue,
  requestStayChange,
  saveStayFeedback,
  settleRefund,
  withdrawStayRequest,
  type DecideResult,
  type RequestResult,
} from "./service";

const id = z.string().min(1).max(64);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const requestInput = z.object({
  kind: z.enum(STAY_REQUEST_KINDS),
  reason: z.string().max(500),
  newCheckOut: day,
  transferTo: z.string().max(120).nullable().optional(),
});

function refresh(reference?: string) {
  revalidatePath("/[locale]/my-stay", "page");
  if (reference) revalidatePath(`/[locale]/admin/bookings/${reference}`, "page");
}

export async function requestStayChangeAction(reference: string, raw: unknown): Promise<RequestResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const parsed = requestInput.safeParse(raw);
  if (!parsed.success || !isBookingReference(reference)) return { ok: false, error: "reason" };
  const result = await requestStayChange(user.id, reference, parsed.data);
  if (result.ok) refresh(reference);
  return result;
}

export async function withdrawStayRequestAction(requestId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(requestId).success) return { ok: false };
  const ok = await withdrawStayRequest(user.id, requestId);
  if (ok) refresh();
  return { ok };
}

export async function reportIssueAction(reference: string, subject: string, body: string): Promise<{ reference: string } | { error: "auth" | "invalid" }> {
  const user = await getCurrentUser();
  if (!user) return { error: "auth" };
  if (!isBookingReference(reference) || typeof subject !== "string" || typeof body !== "string") return { error: "invalid" };
  const result = await reportStayIssue(user.id, reference, subject, body);
  return result.ok ? { reference: result.reference } : { error: "invalid" };
}

export async function feedbackAction(reference: string, liked: boolean, comment: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !isBookingReference(reference) || typeof liked !== "boolean" || typeof comment !== "string") return { ok: false };
  const result = await saveStayFeedback(user.id, reference, liked, comment);
  if (result.ok) refresh();
  return { ok: result.ok };
}

export async function decideStayRequestAction(requestId: string, approve: boolean, response: string, refundAmount: number | null): Promise<DecideResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!id.safeParse(requestId).success || typeof approve !== "boolean" || typeof response !== "string") return { ok: false, error: "invalid" };
  const result = await decideStayRequest(user, requestId, { approve, response, refundAmount });
  if (result.ok) revalidatePath("/[locale]/admin/bookings", "layout");
  return result;
}

export async function settleRefundAction(reference: string, outcome: "REFUNDED" | "DECLINED", note: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user) || !isBookingReference(reference) || !["REFUNDED", "DECLINED"].includes(outcome)) return { ok: false };
  const ok = await settleRefund(user.id, reference, outcome, typeof note === "string" ? note : "");
  if (ok) revalidatePath("/[locale]/admin", "layout");
  return { ok };
}

/** Staff, or the place's owner, manager or receptionist (front desk). */
async function frontDesk(reference: string) {
  const user = await getCurrentUser();
  if (!user || !isBookingReference(reference)) return null;
  if (isAdmin(user)) return user;
  const booking = await db.booking.findUnique({ where: { reference }, select: { listingId: true } });
  return booking && (await canOn(user, booking.listingId, "checkIn")) ? user : null;
}

/** Check a guest in or out from the place's front desk. */
export async function frontDeskMoveAction(reference: string, to: "CHECKED_IN" | "COMPLETED"): Promise<{ ok: boolean }> {
  const user = await frontDesk(reference);
  if (!user || (to !== "CHECKED_IN" && to !== "COMPLETED")) return { ok: false };
  const ok = await staffMoveBooking(user.id, reference, to);
  if (ok) revalidatePath("/[locale]", "layout");
  return { ok };
}

export async function markNoShowAction(reference: string): Promise<{ ok: boolean }> {
  const user = await frontDesk(reference);
  if (!user) return { ok: false };
  const ok = await markNoShow(user.id, reference);
  if (ok) revalidatePath("/[locale]/admin", "layout");
  return { ok };
}
