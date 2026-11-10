import "server-only";
import { audit } from "@/features/audit/service";
import { feesFor } from "@/features/bookings/money";
import { newReference } from "@/features/bookings/reference";
import { notify, notifyAdmins } from "@/features/notifications/service";
import { todayISO } from "@/features/search/date-range";
import { readSettings } from "@/features/settings/service";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { gramsFromKg, laundryPrice, laundrySplit, NEXT_LAUNDRY_STEP, OPEN_LAUNDRY, type LaundryStatus } from "./rules";

type Actor = { id: string; role?: string | null };
const TX = /^[A-Za-z0-9._\-/ ]{4,60}$/;

export const LAUNDRY_SELECT = {
  id: true,
  reference: true,
  status: true,
  note: true,
  pricePerKg: true,
  weightGrams: true,
  amount: true,
  paymentClaim: true,
  paidAt: true,
  cancelReason: true,
  createdAt: true,
} as const;

/** A guest's laundry orders for one stay, newest first. */
export function stayLaundry(bookingId: string) {
  return db.laundryOrder.findMany({ where: { bookingId }, orderBy: { createdAt: "desc" }, select: LAUNDRY_SELECT });
}

export type RequestLaundryResult = { ok: true; reference: string } | { ok: false; error: "notOffered" | "noStay" | "open" };

/**
 * A guest staying now asks for their laundry to be collected. Only while a paid stay is under way at a place that
 * offers laundry; one open request at a time. The place's price per kg is kept on the order. VIIPA staff are told.
 */
export async function requestLaundry(guestId: string, bookingReference: string, note: string, now: Date = new Date()): Promise<RequestLaundryResult> {
  const today = new Date(`${todayISO(now)}T00:00:00Z`);
  const booking = await db.booking.findFirst({
    where: { reference: bookingReference, guestId, status: { in: ["CONFIRMED", "CHECKED_IN"] }, checkIn: { lte: today }, checkOut: { gte: today } },
    select: { id: true, reference: true, listingId: true, room: { select: { name: true } }, listing: { select: { title: true, laundryPricePerKg: true } } },
  });
  if (!booking) return { ok: false, error: "noStay" };
  const price = booking.listing.laundryPricePerKg;
  if (price === null || price < 0) return { ok: false, error: "notOffered" };
  if (await db.laundryOrder.findFirst({ where: { bookingId: booking.id, status: { in: [...OPEN_LAUNDRY] } }, select: { id: true } })) return { ok: false, error: "open" };
  const reference = newReference("LD");
  await db.$transaction(async (tx) => {
    await tx.laundryOrder.create({
      data: { reference, bookingId: booking.id, listingId: booking.listingId, guestId, pricePerKg: price, note: note.trim().slice(0, 300) || null },
    });
    await audit(tx, { actorId: guestId, action: "laundry.request", entityType: "booking", entityId: booking.reference, data: { laundry: reference } });
    const place = [booking.listing.title, booking.room?.name].filter(Boolean).join(" · ");
    await notifyAdmins(tx, "laundryRequested", { reference, title: place }, "/admin/laundry");
  });
  return { ok: true, reference };
}

/** The guest withdraws a request nobody has collected yet. */
export async function cancelMyLaundry(guestId: string, reference: string): Promise<boolean> {
  const { count } = await db.laundryOrder.updateMany({ where: { reference, guestId, status: "REQUESTED" }, data: { status: "CANCELLED", cancelReason: "Cancelled by the guest" } });
  return count === 1;
}

export type MoveLaundryResult = { ok: true } | { ok: false; error: "notAllowed" | "notFound" | "weight" | "reason" };

/**
 * Staff move an order one step: picked up → washed (with the weight, which sets the price) → returned to the
 * guest. Open orders can be cancelled with a reason. The guest is told at every step.
 */
export async function moveLaundry(actor: Actor, reference: string, to: LaundryStatus, input: { kg?: string; reason?: string } = {}): Promise<MoveLaundryResult> {
  if (!isAdmin(actor)) return { ok: false, error: "notAllowed" };
  const order = await db.laundryOrder.findUnique({ where: { reference }, select: { id: true, status: true, pricePerKg: true, guestId: true, listing: { select: { title: true } } } });
  if (!order) return { ok: false, error: "notFound" };
  const cancelling = to === "CANCELLED";
  if (cancelling ? !OPEN_LAUNDRY.includes(order.status) : NEXT_LAUNDRY_STEP[order.status] !== to) return { ok: false, error: "notFound" };
  const data: { status: LaundryStatus; weightGrams?: number; amount?: number; cancelReason?: string } = { status: to };
  if (to === "WASHED") {
    const grams = gramsFromKg(input.kg ?? "");
    if (grams === null) return { ok: false, error: "weight" };
    data.weightGrams = grams;
    data.amount = laundryPrice(grams, order.pricePerKg);
  }
  if (cancelling) {
    const reason = (input.reason ?? "").trim().slice(0, 300);
    if (!reason) return { ok: false, error: "reason" };
    data.cancelReason = reason;
  }
  const moved = await db.$transaction(async (tx) => {
    // Only from the status we read, so two staff can't move the same order twice.
    const { count } = await tx.laundryOrder.updateMany({ where: { id: order.id, status: order.status }, data });
    if (count !== 1) return false;
    await audit(tx, { actorId: actor.id, action: `laundry.${to.toLowerCase()}`, entityType: "laundry", entityId: reference, data: { ...(data.weightGrams ? { grams: data.weightGrams, amount: data.amount } : {}), ...(data.cancelReason ? { reason: data.cancelReason } : {}) } });
    await notify(tx, order.guestId, "laundryUpdate", { reference, title: order.listing.title, statusLabel: to }, "/my-stay");
    return true;
  });
  return moved ? { ok: true } : { ok: false, error: "notFound" };
}

export type ClaimLaundryResult = { ok: true } | { ok: false; error: "notFound" | "transaction" };

/** The guest says they paid the laundry by mobile money and gives the transaction id; staff check and confirm. */
export async function claimLaundryPayment(guestId: string, reference: string, transactionId: string): Promise<ClaimLaundryResult> {
  const tx = transactionId.trim();
  if (!TX.test(tx)) return { ok: false, error: "transaction" };
  const order = await db.laundryOrder.findFirst({ where: { reference, guestId, status: { in: ["WASHED", "RETURNED"] }, amount: { gt: 0 }, paidAt: null }, select: { id: true, listing: { select: { title: true } } } });
  if (!order) return { ok: false, error: "notFound" };
  await db.$transaction(async (t) => {
    await t.laundryOrder.update({ where: { id: order.id }, data: { paymentClaim: tx } });
    await audit(t, { actorId: guestId, action: "laundry.paymentClaim", entityType: "laundry", entityId: reference, data: { providerReference: tx } });
    await notifyAdmins(t, "laundryPaymentClaim", { reference, title: order.listing.title }, "/admin/laundry");
  });
  return { ok: true };
}

export type ConfirmLaundryResult = { ok: true } | { ok: false; error: "notAllowed" | "notFound" | "transaction" | "used" };

/**
 * Staff confirm the laundry money arrived (the guest's transaction, or one staff type). The payment, the platform's
 * commission (the place's category rate) and the place's share are written to the ledger, once.
 */
export async function confirmLaundryPayment(actor: Actor, reference: string, transactionId?: string, now: Date = new Date()): Promise<ConfirmLaundryResult> {
  if (!isAdmin(actor)) return { ok: false, error: "notAllowed" };
  const order = await db.laundryOrder.findUnique({
    where: { reference },
    select: { id: true, status: true, amount: true, paidAt: true, paymentClaim: true, guestId: true, bookingId: true, listing: { select: { hostId: true, title: true, type: true } } },
  });
  if (!order || order.paidAt || !order.amount || order.amount <= 0 || !["WASHED", "RETURNED"].includes(order.status)) return { ok: false, error: "notFound" };
  const tx = (transactionId ?? order.paymentClaim ?? "").trim();
  if (!TX.test(tx)) return { ok: false, error: "transaction" };
  if (await db.laundryOrder.findUnique({ where: { paidReference: tx }, select: { id: true } })) return { ok: false, error: "used" };
  const { commission, placeShare } = laundrySplit(order.amount, feesFor(await readSettings(), order.listing.type).commissionBps);
  const amount = order.amount;
  const done = await db.$transaction(async (t) => {
    const { count } = await t.laundryOrder.updateMany({ where: { id: order.id, paidAt: null }, data: { paidAt: now, paidReference: tx } });
    if (count !== 1) return false;
    const note = `laundry ${reference}`;
    await t.ledgerEntry.createMany({
      data: [
        { kind: "GUEST_PAYMENT" as const, amount, bookingId: order.bookingId, note },
        { kind: "COMMISSION" as const, amount: commission, bookingId: order.bookingId, note },
        { kind: "HOST_PAYABLE" as const, amount: placeShare, bookingId: order.bookingId, hostId: order.listing.hostId, note },
      ].filter((e) => e.amount > 0),
    });
    await audit(t, { actorId: actor.id, action: "laundry.paid", entityType: "laundry", entityId: reference, data: { amount, commission, providerReference: tx } });
    await notify(t, order.guestId, "laundryUpdate", { reference, title: order.listing.title, statusLabel: "PAID" }, "/my-stay");
    return true;
  });
  return done ? { ok: true } : { ok: false, error: "notFound" };
}

/** Staff list: open orders and unpaid ones first, then the latest finished ones. */
export function staffLaundry(take = 100) {
  return db.laundryOrder.findMany({
    orderBy: [{ createdAt: "desc" }],
    take,
    select: {
      ...LAUNDRY_SELECT,
      paidReference: true,
      booking: { select: { reference: true, room: { select: { name: true } }, guest: { select: { name: true, phone: true } } } },
      listing: { select: { title: true } },
    },
  });
}

/** Open laundry orders and payments waiting for staff (sidebar count). */
export function laundryToHandle() {
  return db.laundryOrder.count({ where: { OR: [{ status: { in: [...OPEN_LAUNDRY] } }, { paymentClaim: { not: null }, paidAt: null, status: { not: "CANCELLED" } }] } });
}
