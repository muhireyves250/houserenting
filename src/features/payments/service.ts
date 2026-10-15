import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/features/audit/service";
import { notify, notifyAdmins } from "@/features/notifications/service";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * The callback body every provider is mapped to (MTN MoMo, Airtel Money or a gateway each get a small adapter that
 * produces this). Amounts are whole RWF.
 */
export const callbackBody = z.object({
  eventId: z.string().min(1).max(200),
  provider: z.string().min(1).max(40),
  type: z.enum(["payment.succeeded", "payment.failed"]),
  bookingReference: z.string().min(1).max(20),
  amount: z.number().int().min(0),
  currency: z.string().length(3),
  providerReference: z.string().min(1).max(200),
});

export type CallbackBody = z.infer<typeof callbackBody>;

export type CallbackOutcome =
  | "confirmed"
  | "duplicate"
  | "failedRecorded"
  | "unknownBooking"
  | "amountMismatch"
  | "notPending"
  | "datesTaken";

/**
 * Applies one verified provider callback exactly once. The event id is stored first: a retried callback finds it and
 * changes nothing, so a payment can't confirm a booking or issue a receipt twice.
 */
export async function handlePaymentCallback(event: CallbackBody): Promise<CallbackOutcome> {
  try {
    return await db.$transaction(async (tx) => {
      await tx.paymentEvent.create({ data: { id: event.eventId, provider: event.provider, type: event.type, payload: event, outcome: "processing" } });
      const outcome = await apply(tx, event);
      await tx.paymentEvent.update({ where: { id: event.eventId }, data: { outcome } });
      return outcome;
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return "duplicate";
    throw error;
  }
}

async function apply(tx: Prisma.TransactionClient, event: CallbackBody): Promise<CallbackOutcome> {
  const booking = await tx.booking.findUnique({
    where: { reference: event.bookingReference },
    select: {
      id: true,
      reference: true,
      status: true,
      listingId: true,
      roomId: true,
      checkIn: true,
      checkOut: true,
      guestId: true,
      total: true,
      guestFee: true,
      commission: true,
      hostPayout: true,
      deposit: true,
      discount: true,
      currency: true,
      listing: { select: { hostId: true, title: true } },
    },
  });
  if (!booking) return "unknownBooking";

  if (event.type === "payment.failed") {
    await tx.payment.create({
      data: { bookingId: booking.id, provider: event.provider, providerReference: event.providerReference, amount: event.amount, currency: event.currency, status: "FAILED" },
    });
    if (booking.status === "PENDING_PAYMENT") await notify(tx, booking.guestId, "paymentFailed", { title: booking.listing.title, reference: booking.reference }, `/bookings/${booking.reference}`);
    return "failedRecorded";
  }

  // The provider must have collected exactly what the guest was asked to pay.
  if (event.amount !== booking.total || event.currency !== booking.currency) {
    await tx.payment.create({
      data: { bookingId: booking.id, provider: event.provider, providerReference: event.providerReference, amount: event.amount, currency: event.currency, status: "SUCCEEDED" },
    });
    await notifyAdmins(tx, "paymentProblem", { reference: booking.reference }, "/admin/payments");
    logger.warn({ reference: booking.reference, amount: event.amount }, "payment amount mismatch");
    return "amountMismatch";
  }

  // Money arrived for a booking that is no longer waiting (cancelled, or its hold ended and the dates were taken):
  // keep the payment on record and flag it for a refund by staff.
  let confirmable = booking.status === "PENDING_PAYMENT";
  if (booking.status === "EXPIRED") {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.listingId}))`;
    const clash = await tx.booking.findFirst({
      where: {
        id: { not: booking.id },
        listingId: booking.listingId,
        status: { in: ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] },
        checkIn: { lt: booking.checkOut },
        checkOut: { gt: booking.checkIn },
        ...(booking.roomId ? { OR: [{ roomId: booking.roomId }, { roomId: null }] } : {}),
      },
      select: { id: true },
    });
    confirmable = !clash;
  }
  const payment = await tx.payment.create({
    data: { bookingId: booking.id, provider: event.provider, providerReference: event.providerReference, amount: event.amount, currency: event.currency, status: "SUCCEEDED" },
  });
  if (!confirmable) {
    await notifyAdmins(tx, "paymentProblem", { reference: booking.reference }, "/admin/payments");
    return booking.status === "EXPIRED" ? "datesTaken" : "notPending";
  }

  await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", holdExpiresAt: null } });
  await tx.bookingEvent.create({
    data: { bookingId: booking.id, fromStatus: booking.status, toStatus: "CONFIRMED", reason: `payment ${event.providerReference} verified (${event.provider})` },
  });

  // Ledger: what the guest paid and where it goes. Never all platform revenue.
  const host = booking.listing.hostId;
  const entries: Prisma.LedgerEntryCreateManyInput[] = [
    { kind: "GUEST_PAYMENT", amount: booking.total, bookingId: booking.id, note: payment.id },
    { kind: "HOST_PAYABLE", amount: booking.hostPayout, bookingId: booking.id, hostId: host },
    { kind: "COMMISSION", amount: booking.commission, bookingId: booking.id },
    { kind: "GUEST_FEE", amount: booking.guestFee, bookingId: booking.id },
    { kind: "DEPOSIT_HELD", amount: booking.deposit, bookingId: booking.id, hostId: host },
    { kind: "PROMO_DISCOUNT", amount: booking.discount, bookingId: booking.id },
  ];
  await tx.ledgerEntry.createMany({ data: entries.filter((e) => e.amount > 0) });
  await audit(tx, { actorId: null, action: "booking.paid", entityType: "booking", entityId: booking.reference, data: { amount: event.amount, provider: event.provider, providerReference: event.providerReference } });
  await notify(tx, booking.guestId, "bookingConfirmed", { title: booking.listing.title, reference: booking.reference }, `/bookings/${booking.reference}`);
  await notify(tx, host, "newBooking", { title: booking.listing.title, reference: booking.reference }, "/host");
  return "confirmed";
}

/** Payments needing a person: amount mismatches and money received for bookings that couldn't be confirmed. */
export function paymentsToReview() {
  return db.paymentEvent.findMany({
    where: { outcome: { in: ["amountMismatch", "datesTaken", "notPending", "unknownBooking"] } },
    orderBy: { receivedAt: "desc" },
    take: 100,
  });
}

export function recentPayments(take = 100) {
  return db.payment.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, provider: true, providerReference: true, amount: true, currency: true, status: true, createdAt: true, booking: { select: { reference: true, listing: { select: { title: true } } } } },
  });
}
