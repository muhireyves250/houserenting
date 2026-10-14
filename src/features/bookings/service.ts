import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { maskPhone, parseMobileMoney, type MoMoProvider } from "@/features/listings/mobile-money";
import { discountedPrice } from "@/features/listings/pricing";
import { nightsBetween } from "@/features/listings/quote";
import { todayISO, type BookedRange, type ISODate } from "@/features/search/date-range";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { notify } from "@/features/notifications/service";
import { newBookingReference } from "./reference";
import { audit } from "@/features/audit/service";
import { BLOCKING_STATUSES, canTransition } from "./status";

export type BookingRequest = {
  guestId: string;
  listingId: string;
  checkIn: ISODate;
  checkOut: ISODate;
  guests: number;
  payment: { method: MoMoProvider; phone: string };
};

export type BookingError = "invalid" | "notFound" | "ownListing" | "stayLength" | "phone" | "unavailable";
export type CreateBookingResult = { ok: true; reference: string } | { ok: false; error: BookingError };

/** What the guest agreed to, stored with the booking so later edits to the listing don't change it. */
export type PolicySnapshot = {
  checkInTime: string | null;
  checkOutTime: string | null;
  houseRules: string[];
  /** Cancellation terms; null until the platform owner publishes them. */
  cancellationPolicy: string | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function isRealDate(iso: unknown): iso is ISODate {
  if (typeof iso !== "string" || !ISO_DATE.test(iso)) return false;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso);
}
const asDate = (iso: ISODate) => new Date(`${iso}T00:00:00Z`);
const asISO = (date: Date): ISODate => date.toISOString().slice(0, 10);

type Tx = Prisma.TransactionClient;

/** Lapses unpaid holds past their time (and logs it), so their dates can be booked again. */
async function expireHolds(tx: Tx, where: Prisma.BookingWhereInput, now: Date): Promise<void> {
  const stale = await tx.booking.findMany({
    where: { ...where, status: "PENDING_PAYMENT", holdExpiresAt: { lte: now } },
    select: { id: true, guestId: true, reference: true, listing: { select: { title: true } } },
  });
  for (const { id, guestId, reference, listing } of stale) {
    const { count } = await tx.booking.updateMany({ where: { id, status: "PENDING_PAYMENT" }, data: { status: "EXPIRED" } });
    if (count === 1) {
      await tx.bookingEvent.create({ data: { bookingId: id, fromStatus: "PENDING_PAYMENT", toStatus: "EXPIRED", reason: "payment hold expired" } });
      await notify(tx, guestId, "bookingExpired", { title: listing.title, reference }, `/bookings/${reference}`);
    }
  }
}

/** Postgres refused the insert because the nights overlap an active booking (constraint "booking_no_overlap"). */
function isOverlapError(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && depth < 5; depth++) {
    const text = `${(e as { code?: string }).code ?? ""} ${(e as { message?: string }).message ?? ""} ${JSON.stringify((e as { meta?: unknown }).meta ?? "")}`;
    if (text.includes("23P01") || text.includes("booking_no_overlap")) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

function isUniqueReferenceError(error: unknown): boolean {
  return (error as { code?: string }).code === "P2002";
}

/**
 * Books a stay and holds its dates until payment, all checked on the server: the price comes from the listing's
 * rates, and the database itself refuses a stay that overlaps another active booking.
 */
export async function createBooking(request: BookingRequest, now: Date = new Date()): Promise<CreateBookingResult> {
  const { guestId, listingId, checkIn, checkOut, guests } = request;
  if (!isRealDate(checkIn) || !isRealDate(checkOut) || checkIn < todayISO(now)) return { ok: false, error: "invalid" };
  const nights = nightsBetween({ checkIn, checkOut });
  if (nights < 1 || !Number.isInteger(guests) || guests < 1) return { ok: false, error: "invalid" };

  const listing = await db.listing.findFirst({
    where: { id: listingId, status: "PUBLISHED" },
    select: { title: true, hostId: true, maxGuests: true, discountPercent: true, termsOfRent: true, rates: { where: { unit: "NIGHT" } } },
  });
  const night = listing?.rates[0];
  if (!listing || !night) return { ok: false, error: "notFound" };
  if (listing.hostId === guestId) return { ok: false, error: "ownListing" };
  if (guests > listing.maxGuests) return { ok: false, error: "invalid" };
  if (nights < night.minUnits || (night.maxUnits !== null && nights > night.maxUnits)) return { ok: false, error: "stayLength" };

  const phone = parseMobileMoney(request.payment.method, request.payment.phone);
  if (!phone.ok) return { ok: false, error: "phone" };

  const nightlyPrice = discountedPrice(night.price, listing.discountPercent);
  const policySnapshot: PolicySnapshot = {
    checkInTime: night.checkInTime,
    checkOutTime: night.checkOutTime,
    houseRules: listing.termsOfRent,
    cancellationPolicy: null,
  };
  const holdExpiresAt = new Date(now.getTime() + getEnv().BOOKING_HOLD_MINUTES * 60_000);

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = newBookingReference();
    try {
      await db.$transaction(async (tx) => {
        await expireHolds(tx, { listingId }, now);
        await tx.booking.create({
          data: {
            reference,
            listingId,
            guestId,
            checkIn: asDate(checkIn),
            checkOut: asDate(checkOut),
            nights,
            guests,
            nightlyPrice,
            total: nightlyPrice * nights,
            paymentMethod: request.payment.method,
            payerPhone: maskPhone(phone.number),
            policySnapshot,
            holdExpiresAt,
            events: { create: { fromStatus: null, toStatus: "PENDING_PAYMENT", actorId: guestId, reason: "booked by guest" } },
          },
        });
        await notify(tx, guestId, "bookingHeld", { title: listing.title, reference }, `/bookings/${reference}`);
      });
      return { ok: true, reference };
    } catch (error) {
      if (isOverlapError(error)) return { ok: false, error: "unavailable" };
      if (isUniqueReferenceError(error)) continue;
      throw error;
    }
  }
  logger.error({ listingId }, "could not find a free booking reference");
  throw new Error("Could not create a booking reference");
}

/** Nights a listing can't offer from today on (paid stays and live holds). */
export async function bookedRanges(listingId: string, now: Date = new Date()): Promise<BookedRange[]> {
  const rows = await db.booking.findMany({
    where: {
      listingId,
      checkOut: { gt: asDate(todayISO(now)) },
      OR: [{ status: { in: ["CONFIRMED", "CHECKED_IN"] } }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }],
    },
    select: { checkIn: true, checkOut: true },
    orderBy: { checkIn: "asc" },
  });
  return rows.map((r) => ({ checkIn: asISO(r.checkIn), checkOut: asISO(r.checkOut) }));
}

const GUEST_SELECT = {
  reference: true,
  status: true,
  checkIn: true,
  checkOut: true,
  nights: true,
  guests: true,
  nightlyPrice: true,
  total: true,
  currency: true,
  paymentMethod: true,
  payerPhone: true,
  holdExpiresAt: true,
  createdAt: true,
  listing: {
    select: {
      id: true,
      title: true,
      type: true,
      district: true,
      city: true,
      addressLine: true,
      lat: true,
      lng: true,
      photos: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
    },
  },
} satisfies Prisma.BookingSelect;

function toGuestBooking<T extends { checkIn: Date; checkOut: Date }>(row: T) {
  return { ...row, checkIn: asISO(row.checkIn), checkOut: asISO(row.checkOut) };
}

/** The guest's bookings, newest stay first. */
export async function guestBookings(guestId: string, now: Date = new Date()) {
  await db.$transaction((tx) => expireHolds(tx, { guestId }, now));
  const rows = await db.booking.findMany({ where: { guestId }, select: GUEST_SELECT, orderBy: [{ checkIn: "desc" }, { createdAt: "desc" }] });
  return rows.map(toGuestBooking);
}

export type GuestBooking = Awaited<ReturnType<typeof guestBookings>>[number];

/** One of the guest's bookings with its status history; null for anyone else's. */
export async function getGuestBooking(guestId: string, reference: string, now: Date = new Date()) {
  await db.$transaction((tx) => expireHolds(tx, { guestId, reference }, now));
  const row = await db.booking.findFirst({
    where: { guestId, reference },
    select: {
      ...GUEST_SELECT,
      policySnapshot: true,
      events: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return null;
  return { ...toGuestBooking(row), policySnapshot: row.policySnapshot as PolicySnapshot };
}

export type GuestBookingDetail = NonNullable<Awaited<ReturnType<typeof getGuestBooking>>>;

/** The guest lets go of an unpaid hold. Paid bookings follow the cancellation policy (not live yet). */
export async function cancelPendingBooking(guestId: string, reference: string, now: Date = new Date()): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findFirst({ where: { guestId, reference }, select: { id: true, status: true, holdExpiresAt: true } });
    if (!booking || booking.status !== "PENDING_PAYMENT") return false;
    if (booking.holdExpiresAt && booking.holdExpiresAt <= now) {
      await expireHolds(tx, { id: booking.id }, now);
      return false;
    }
    const { count } = await tx.booking.updateMany({ where: { id: booking.id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
    if (count !== 1) return false;
    await tx.bookingEvent.create({
      data: { bookingId: booking.id, fromStatus: "PENDING_PAYMENT", toStatus: "CANCELLED", actorId: guestId, reason: "cancelled by guest" },
    });
    return true;
  });
}

export { BLOCKING_STATUSES };

/** Reception: check a paid guest in (from the check-in day), then out. Every move is logged with who made it. */
export async function staffMoveBooking(
  staffId: string,
  reference: string,
  to: "CHECKED_IN" | "COMPLETED",
  now: Date = new Date(),
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { reference }, select: { id: true, status: true, checkIn: true, guestId: true } });
    if (!booking || !canTransition(booking.status, to)) return false;
    if (to === "CHECKED_IN" && asISO(booking.checkIn) > todayISO(now)) return false;
    const { count } = await tx.booking.updateMany({ where: { id: booking.id, status: booking.status }, data: { status: to } });
    if (count !== 1) return false;
    await tx.bookingEvent.create({
      data: { bookingId: booking.id, fromStatus: booking.status, toStatus: to, actorId: staffId, reason: to === "CHECKED_IN" ? "checked in" : "checked out" },
    });
    await audit(tx, { actorId: staffId, action: to === "CHECKED_IN" ? "booking.checkIn" : "booking.checkOut", entityType: "booking", entityId: reference });
    return true;
  });
}

/** Staff list: bookings that are live or coming up first. */
export function staffBookings(take = 100) {
  return db.booking.findMany({
    orderBy: [{ checkIn: "desc" }],
    take,
    select: {
      reference: true,
      status: true,
      checkIn: true,
      checkOut: true,
      total: true,
      holdExpiresAt: true,
      guest: { select: { name: true, email: true } },
      listing: { select: { id: true, title: true } },
    },
  });
}
