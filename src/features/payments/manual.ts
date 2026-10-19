import "server-only";
import { audit } from "@/features/audit/service";
import { notify, notifyAdmins } from "@/features/notifications/service";
import { canOn } from "@/features/places/access";
import { db } from "@/lib/db";
import { handlePaymentCallback, type CallbackOutcome } from "./service";

type Actor = { id: string; role?: string | null };
const TX = /^[A-Za-z0-9._\-/ ]{4,60}$/;
const CLAIM_HOLD_MS = 24 * 60 * 60 * 1000;

export type ClaimResult = { ok: true } | { ok: false; error: "notPayable" | "transaction" | "used" | "waiting" };

/**
 * The guest says they paid by mobile money and gives the transaction id. Their dates stay held for 24 hours while
 * the owner or staff check it; the owner and staff are told. Nothing is confirmed until one of them does.
 */
export async function claimPayment(guestId: string, reference: string, transactionId: string, now: Date = new Date()): Promise<ClaimResult> {
  const tx = transactionId.trim();
  if (!TX.test(tx)) return { ok: false, error: "transaction" };
  const booking = await db.booking.findFirst({
    where: { reference, guestId, status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
    select: { id: true, total: true, currency: true, holdExpiresAt: true, listing: { select: { hostId: true, title: true } }, payments: { where: { status: "PENDING" }, select: { id: true } } },
  });
  if (!booking) return { ok: false, error: "notPayable" };
  if (booking.payments.length > 0) return { ok: false, error: "waiting" };
  if (await db.payment.findUnique({ where: { providerReference: tx }, select: { id: true } })) return { ok: false, error: "used" };
  const keepUntil = new Date(Math.max(booking.holdExpiresAt!.getTime(), now.getTime() + CLAIM_HOLD_MS));
  await db.$transaction(async (t) => {
    await t.payment.create({ data: { bookingId: booking.id, provider: "manual", providerReference: tx, amount: booking.total, currency: booking.currency, status: "PENDING" } });
    await t.booking.update({ where: { id: booking.id }, data: { holdExpiresAt: keepUntil } });
    await audit(t, { actorId: guestId, action: "booking.paymentClaim", entityType: "booking", entityId: reference, data: { providerReference: tx } });
    const data = { reference, title: booking.listing.title };
    await notify(t, booking.listing.hostId, "paymentClaim", data, "/host/bookings");
    await notifyAdmins(t, "paymentClaim", data, `/admin/bookings/${reference}`);
  });
  return { ok: true };
}

export type ConfirmResult = { ok: true } | { ok: false; error: "notAllowed" | "notFound" | "transaction" | "amount" | Exclude<CallbackOutcome, "confirmed"> };

/**
 * Staff or the place's owner confirm a payment they received (checked in their mobile money or bank statement).
 * It goes through the same steps as a provider confirmation: amount check, dates still free, ledger, receipt,
 * notifications, and it is recorded with who confirmed it.
 */
export async function confirmPaymentByHand(actor: Actor, reference: string, input: { transactionId: string; amount: number }): Promise<ConfirmResult> {
  const booking = await db.booking.findUnique({ where: { reference }, select: { listingId: true, currency: true, total: true } });
  if (!booking) return { ok: false, error: "notFound" };
  if (!(await canOn(actor, booking.listingId, "money"))) return { ok: false, error: "notAllowed" };
  const tx = input.transactionId.trim();
  if (!TX.test(tx)) return { ok: false, error: "transaction" };
  // By hand, the amount must be exactly the booking's total (a different amount is a question for staff, not a confirmation).
  if (!Number.isInteger(input.amount) || input.amount !== booking.total) return { ok: false, error: "amount" };
  const outcome = await handlePaymentCallback(
    { eventId: `manual:${reference}:${tx}`, provider: "manual", type: "payment.succeeded", bookingReference: reference, amount: input.amount, currency: booking.currency, providerReference: tx },
    actor.id,
  );
  return outcome === "confirmed" ? { ok: true } : { ok: false, error: outcome };
}

/** Staff or the owner say the money didn't arrive: the guest's note is closed with a reason they see. */
export async function rejectPaymentClaim(actor: Actor, reference: string, reason: string): Promise<boolean> {
  const why = reason.trim().slice(0, 300);
  if (!why) return false;
  const booking = await db.booking.findUnique({ where: { reference }, select: { id: true, listingId: true, guestId: true, listing: { select: { title: true } } } });
  if (!booking || !(await canOn(actor, booking.listingId, "money"))) return false;
  return db.$transaction(async (t) => {
    const { count } = await t.payment.updateMany({ where: { bookingId: booking.id, status: "PENDING", provider: "manual" }, data: { status: "FAILED" } });
    if (count === 0) return false;
    await audit(t, { actorId: actor.id, action: "booking.paymentRejected", entityType: "booking", entityId: reference, data: { reason: why } });
    await notify(t, booking.guestId, "paymentNotReceived", { reference, title: booking.listing.title, reason: why }, `/bookings/${reference}`);
    return true;
  });
}
