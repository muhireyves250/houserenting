import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { maskPhone, parseMobileMoney, type MoMoProvider } from "@/features/listings/mobile-money";
import { discountedPrice } from "@/features/listings/pricing";
import { nightsBetween } from "@/features/listings/quote";
import { todayISO, type BookedRange, type ISODate } from "@/features/search/date-range";
import { db } from "@/lib/db";
import { holdMinutesFrom, readSettings, type CancellationPolicy } from "@/features/settings/service";
import { logger } from "@/lib/logger";
import { notify } from "@/features/notifications/service";
import { newBookingReference } from "./reference";
import { audit } from "@/features/audit/service";
import { checkPromo, claimPromoUse, type PromoCheck } from "@/features/promotions/service";
import { maybeCreateReward } from "@/features/referrals/service";
import { priceBreakdown } from "./money";
import { BOOKING_UNITS, LONG_UNITS, periodFor, unitsAllowedFor, withinHours, type BookingUnit } from "./period";
import { BLOCKING_STATUSES, canTransition } from "./status";

export type BookingRequest = {
  guestId: string;
  listingId: string;
  checkIn: ISODate;
  checkOut: ISODate;
  guests: number;
  /** One room of the place; null or missing = the whole place. */
  roomId?: string | null;
  promoCode?: string | null;
  payment: { method: MoMoProvider; phone: string };
};

export type BookingError = "invalid" | "notFound" | "ownListing" | "stayLength" | "phone" | "unavailable" | "promo" | "notOffered" | "identity";
export type CreateBookingResult = { ok: true; reference: string } | { ok: false; error: BookingError };

/** What the guest agreed to, stored with the booking so later edits to the listing don't change it. */
export type PolicySnapshot = {
  checkInTime: string | null;
  checkOutTime: string | null;
  houseRules: string[];
  /** Cancellation terms in force when booked, per language; null until the platform publishes them. */
  cancellationPolicy: CancellationPolicy | null;
  /** The room booked, if not the whole place. */
  room?: string | null;
  /** Fee settings used for this booking's price split. */
  fees?: { commissionBps: number | null; guestFeeBps: number | null };
  /** Monthly rentals: length, months paid when booking, deposit setting. */
  monthly?: { months: number; upfrontMonths: number; depositPercent: number | null };
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

class Unavailable extends Error {}

function isUniqueReferenceError(error: unknown): boolean {
  return (error as { code?: string }).code === "P2002";
}

/** A booking by the hour, day, night, week, month or year, of the whole place or one room. */
export type RentalRequest = {
  guestId: string;
  listingId: string;
  unit: BookingUnit;
  /** First day (and for hours, the start time "HH:MM"). */
  start: ISODate;
  startTime?: string | null;
  /** How many hours/days/nights/weeks/months/years. */
  quantity: number;
  guests: number;
  /** One room of the place; null or missing = the whole place. */
  roomId?: string | null;
  promoCode?: string | null;
  payment: { method: MoMoProvider; phone: string };
  /** Long stays: only the details staff have said the business needs (Admin → Settings). */
  identity?: { idNumber: string; nationality: string | null } | null;
};

const MAX_QUANTITY: Record<BookingUnit, number> = { HOUR: 24, DAY: 365, NIGHT: 365, WEEK: 104, MONTH: 60, YEAR: 10 };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Books a place (or one of its rooms) for the way the host offers it, and holds it until payment. Everything is
 * checked on the server: the unit must be one the place (or room) offers (lodges: nights or days only), the price
 * comes from the host's rates, and overlapping bookings are refused on exact times by the database.
 */
export async function createRentalBooking(request: RentalRequest, now: Date = new Date()): Promise<CreateBookingResult> {
  const { guestId, listingId, unit, start, quantity, guests } = request;
  if (!BOOKING_UNITS.includes(unit) || !isRealDate(start) || start < todayISO(now)) return { ok: false, error: "invalid" };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY[unit] || !Number.isInteger(guests) || guests < 1) return { ok: false, error: "invalid" };
  const startTime = unit === "HOUR" ? (request.startTime ?? "") : null;
  if (unit === "HOUR" && !HHMM.test(startTime ?? "")) return { ok: false, error: "invalid" };

  const listing = await db.listing.findFirst({
    where: { id: listingId, status: "PUBLISHED" },
    select: { title: true, type: true, hostId: true, maxGuests: true, discountPercent: true, termsOfRent: true, bookingModel: true, rates: true },
  });
  if (!listing) return { ok: false, error: "notFound" };
  if (listing.hostId === guestId) return { ok: false, error: "ownListing" };
  if (!unitsAllowedFor(listing.type).includes(unit)) return { ok: false, error: "notOffered" };
  const rate = listing.rates.find((r) => r.unit === unit) ?? null;
  const roomId = request.roomId ?? null;

  // What is being booked: the whole place at its rate for this unit, or one available room at the room's rate.
  let base: number;
  let room: { id: string; name: string } | null = null;
  if (roomId === null) {
    if (listing.bookingModel === "ROOM_BY_ROOM") return { ok: false, error: "notFound" };
    if (!rate) return { ok: false, error: "notOffered" };
    if (guests > listing.maxGuests) return { ok: false, error: "invalid" };
    base = rate.price;
  } else {
    if (listing.bookingModel === "WHOLE_PROPERTY") return { ok: false, error: "notFound" };
    const found = await db.room.findFirst({ where: { id: roomId, listingId, status: "AVAILABLE" }, include: { rates: true } });
    if (!found) return { ok: false, error: "unavailable" };
    const roomRate = found.rates.find((r) => r.unit === unit);
    if (!roomRate) return { ok: false, error: "notOffered" };
    if (guests > found.maxGuests) return { ok: false, error: "invalid" };
    base = roomRate.price;
    room = { id: found.id, name: found.name };
  }
  // Length and opening hours follow the place's rules for this unit (when set).
  if (rate && (quantity < rate.minUnits || (rate.maxUnits !== null && quantity > rate.maxUnits))) return { ok: false, error: "stayLength" };
  if (unit === "HOUR" && !withinHours(startTime!, quantity, rate?.dayStartTime ?? null, rate?.dayEndTime ?? null)) return { ok: false, error: "stayLength" };

  const phone = parseMobileMoney(request.payment.method, request.payment.phone);
  if (!phone.ok) return { ok: false, error: "phone" };

  const settings = await readSettings();
  const long = LONG_UNITS.includes(unit);
  // Long stays: identity details exactly as staff set them.
  const idNumber = request.identity?.idNumber.trim() ?? "";
  const nationality = request.identity?.nationality?.trim() ?? "";
  const needsId = long && settings.monthlyIdentity !== "NONE";
  const needsNationality = long && settings.monthlyIdentity === "ID_NATIONALITY";
  if ((needsId && idNumber.length < 4) || (needsNationality && nationality.length < 2)) return { ok: false, error: "identity" };
  const identity = needsId ? { idNumber, nationality: needsNationality ? nationality : null } : null;

  const unitPrice = discountedPrice(base, listing.discountPercent);
  // Monthly: all chosen months now unless staff set fewer upfront. Everything else is paid in full.
  const paidUnits = unit === "MONTH" ? Math.min(settings.monthlyUpfrontMonths ?? quantity, quantity) : quantity;
  // Deposit for long stays: a percent of one month's rent (a year's rent / 12).
  const monthRent = unit === "MONTH" ? unitPrice : unit === "YEAR" ? Math.round(unitPrice / 12) : 0;
  const deposit = long && settings.monthlyDepositPercent ? Math.round((monthRent * settings.monthlyDepositPercent) / 100) : 0;
  const fees = { commissionBps: settings.commissionBps, guestFeeBps: settings.guestFeeBps };
  let promo: Extract<PromoCheck, { ok: true }> | null = null;
  if (request.promoCode) {
    const checked = await checkPromo(db, request.promoCode, unitPrice * paidUnits, now);
    if (!checked.ok) return { ok: false, error: "promo" };
    promo = checked;
  }
  const money = priceBreakdown(unitPrice * paidUnits, fees, promo ? { amount: promo.discount, fundedBy: promo.fundedBy } : null);
  const period = periodFor(unit, start, quantity, startTime);
  const night = listing.rates.find((r) => r.unit === "NIGHT");
  const hasPolicy = Object.values(settings.cancellationPolicy).some(Boolean);
  const policySnapshot: PolicySnapshot = {
    checkInTime: unit === "NIGHT" ? (night?.checkInTime ?? null) : null,
    checkOutTime: unit === "NIGHT" ? (night?.checkOutTime ?? null) : null,
    houseRules: listing.termsOfRent,
    cancellationPolicy: hasPolicy ? settings.cancellationPolicy : null,
    room: room?.name ?? null,
    fees,
    ...(long ? { monthly: { months: unit === "YEAR" ? quantity * 12 : quantity, upfrontMonths: unit === "MONTH" ? paidUnits : quantity * 12, depositPercent: settings.monthlyDepositPercent } } : {}),
  };

  return holdAndInsert({
    listingId,
    title: listing.title,
    guestId,
    checkIn: period.checkIn,
    checkOut: period.checkOut,
    startAt: period.startAt,
    endAt: period.endAt,
    roomId: room?.id ?? null,
    promoId: promo?.id ?? null,
    identity,
    now,
    data: {
      unit,
      quantity,
      rentalMode: long ? "MONTHLY" : "STAY",
      months: unit === "MONTH" ? quantity : unit === "YEAR" ? quantity * 12 : null,
      upfrontMonths: unit === "MONTH" ? paidUnits : null,
      nights: nightsBetween({ checkIn: period.checkIn, checkOut: period.checkOut }),
      guests,
      nightlyPrice: unitPrice,
      ...money,
      deposit,
      total: money.total + deposit,
      promoCodeId: promo?.id ?? null,
      paymentMethod: request.payment.method,
      payerPhone: maskPhone(phone.number),
      policySnapshot,
      holdExpiresAt: new Date(now.getTime() + holdMinutesFrom(settings) * 60_000),
    },
  });
}

/** Nightly stay from check-in to checkout (the calendar on the listing page). */
export async function createBooking(request: BookingRequest, now: Date = new Date()): Promise<CreateBookingResult> {
  const { checkIn, checkOut, ...rest } = request;
  if (!isRealDate(checkIn) || !isRealDate(checkOut)) return { ok: false, error: "invalid" };
  const nights = nightsBetween({ checkIn, checkOut });
  if (nights < 1) return { ok: false, error: "invalid" };
  return createRentalBooking({ ...rest, unit: "NIGHT", start: checkIn, quantity: nights }, now);
}

class PromoGone extends Error {}

/**
 * Inserts a booking that holds its dates, safely: one booking at a time per place (advisory lock), lapsed holds
 * released first, then a clash check (the whole place clashes with anything; a room with itself and whole-place stays),
 * with the database constraint as a final guard. A promo use is counted in the same transaction.
 */
async function holdAndInsert(args: {
  listingId: string;
  title: string;
  guestId: string;
  checkIn: ISODate;
  checkOut: ISODate;
  startAt: Date;
  endAt: Date;
  roomId: string | null;
  promoId: string | null;
  now: Date;
  /** Monthly rentals: identity details, kept apart from the booking and shown to staff only. */
  identity?: { idNumber: string; nationality: string | null } | null;
  data: Omit<Prisma.BookingUncheckedCreateInput, "reference" | "listingId" | "guestId" | "checkIn" | "checkOut" | "roomId" | "startAt" | "endAt">;
}): Promise<CreateBookingResult> {
  const { listingId, guestId, checkIn, checkOut, startAt, endAt, roomId, now } = args;
  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = newBookingReference();
    try {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${listingId}))`;
        await expireHolds(tx, { listingId }, now);
        const clash = await tx.booking.findFirst({
          where: {
            listingId,
            status: { in: [...BLOCKING_STATUSES] },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
            ...(roomId ? { OR: [{ roomId }, { roomId: null }] } : {}),
          },
          select: { id: true },
        });
        if (clash) throw new Unavailable();
        if (args.promoId && !(await claimPromoUse(tx, args.promoId))) throw new PromoGone();
        const created = await tx.booking.create({
          data: {
            ...args.data,
            reference,
            listingId,
            guestId,
            roomId,
            checkIn: asDate(checkIn),
            checkOut: asDate(checkOut),
            startAt,
            endAt,
            events: { create: { fromStatus: null, toStatus: "PENDING_PAYMENT", actorId: guestId, reason: "booked by guest" } },
          },
          select: { id: true },
        });
        if (args.identity) await tx.bookingIdentity.create({ data: { bookingId: created.id, ...args.identity } });
        await notify(tx, guestId, "bookingHeld", { title: args.title, reference }, `/bookings/${reference}`);
      });
      return { ok: true, reference };
    } catch (error) {
      if (error instanceof Unavailable || isOverlapError(error)) return { ok: false, error: "unavailable" };
      if (error instanceof PromoGone) return { ok: false, error: "promo" };
      if (isUniqueReferenceError(error)) continue;
      throw error;
    }
  }
  logger.error({ listingId }, "could not find a free booking reference");
  throw new Error("Could not create a booking reference");
}

export type MonthlyRequest = {
  guestId: string;
  listingId: string;
  start: ISODate;
  months: number;
  promoCode?: string | null;
  payment: { method: MoMoProvider; phone: string };
  identity?: { idNumber: string; nationality: string | null } | null;
};

/** Monthly rental of the whole place (the client chooses the months). */
export function createMonthlyBooking(request: MonthlyRequest, now: Date = new Date()): Promise<CreateBookingResult> {
  const { start, months, ...rest } = request;
  return createRentalBooking({ ...rest, unit: "MONTH", start, quantity: months, guests: 1 }, now);
}

/** Nights taken from today on (paid stays and live holds); `roomId` null = a whole-place stay. Dates only, no guest data. */
export async function bookedRanges(listingId: string, now: Date = new Date()): Promise<(BookedRange & { roomId: string | null })[]> {
  const rows = await db.booking.findMany({
    where: {
      listingId,
      checkOut: { gt: asDate(todayISO(now)) },
      OR: [{ status: { in: ["CONFIRMED", "CHECKED_IN"] } }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }],
    },
    select: { checkIn: true, checkOut: true, roomId: true },
    orderBy: { checkIn: "asc" },
  });
  return rows.map((r) => ({ checkIn: asISO(r.checkIn), checkOut: asISO(r.checkOut), roomId: r.roomId }));
}

const GUEST_SELECT = {
  reference: true,
  status: true,
  checkIn: true,
  checkOut: true,
  nights: true,
  guests: true,
  nightlyPrice: true,
  unit: true,
  quantity: true,
  startAt: true,
  endAt: true,
  subtotal: true,
  guestFee: true,
  discount: true,
  deposit: true,
  rentalMode: true,
  months: true,
  upfrontMonths: true,
  total: true,
  currency: true,
  room: { select: { name: true } },
  promoCode: { select: { code: true } },
  payments: { where: { status: "SUCCEEDED" }, select: { provider: true, providerReference: true, createdAt: true }, take: 1 },
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
    if (to === "COMPLETED") await maybeCreateReward(tx, booking.id);
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
      commission: true,
      hostPayout: true,
      holdExpiresAt: true,
      room: { select: { name: true } },
      rentalMode: true,
      months: true,
      identity: { select: { idNumber: true, nationality: true } },
      guest: { select: { name: true, email: true } },
      listing: { select: { id: true, title: true } },
    },
  });
}

/** Background job: releases every unpaid hold past its time (they are also released whenever a place is booked). */
export async function expireAllHolds(now: Date = new Date()): Promise<number> {
  const before = await db.booking.count({ where: { status: "PENDING_PAYMENT", holdExpiresAt: { lte: now } } });
  if (before > 0) await db.$transaction((tx) => expireHolds(tx, {}, now));
  return before;
}
