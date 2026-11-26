import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { maskPhone, parseMobileMoney, type MoMoProvider } from "@/features/listings/mobile-money";
import { discountedPrice } from "@/features/listings/pricing";
import { nightsBetween } from "@/features/listings/quote";
import { todayISO, type BookedRange, type ISODate } from "@/features/search/date-range";
import { db } from "@/lib/db";
import { priceOfRoom } from "@/features/rooms/validation";
import { isCustomer } from "@/lib/customer";
import { holdMinutesFrom, readSettings, type CancellationPolicy } from "@/features/settings/service";
import { logger } from "@/lib/logger";
import { notify } from "@/features/notifications/service";
import { newBookingReference } from "./reference";
import { audit } from "@/features/audit/service";
import { checkPromo, claimPromoUse, type PromoCheck } from "@/features/promotions/service";
import { maybeCreateReward } from "@/features/referrals/service";
import { maybePromoterReward } from "@/features/promoters/service";
import { feesFor, priceBreakdown } from "./money";
import { agreementAt } from "@/features/agreements/service";
import { bookableWindow, insideWindow, onWorkingDays } from "./availability";
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
  /** A specific room number of that room type; missing = the first free one. */
  roomNumber?: string | null;
  promoCode?: string | null;
  payment: { method: MoMoProvider; phone: string };
};

export type BookingError =
  | "invalid"
  | "pastTime"
  | "notFound"
  | "ownListing"
  | "notCustomer"
  | "stayLength"
  | "phone"
  | "unavailable"
  | "promo"
  | "notOffered"
  | "identity"
  | "outsideWindow"
  | "closedDay";
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
export function isOverlapError(error: unknown): boolean {
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
  /** A specific room number of that room type; missing = the first free one. */
  roomNumber?: string | null;
  promoCode?: string | null;
  payment: { method: MoMoProvider; phone: string };
  /** Long stays: only the details staff have said the business needs (Admin → Settings). */
  identity?: { idNumber: string; nationality: string | null } | null;
  /** Booking for a company: its TIN and purchase code (EBM invoice); none = the EBM goes to the payer's phone. */
  company?: { tin: string; purchaseCode: string } | null;
};

const MAX_QUANTITY: Record<BookingUnit, number> = { HOUR: 24, DAY: 365, NIGHT: 365, WEEK: 104, MONTH: 60, YEAR: 10 };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Books a place (or one of its rooms) for the way the host offers it, and holds it until payment. Everything is
 * checked on the server: the unit must be one the place (or room) offers (lodges: hours, days or nights), the price
 * comes from the host's rates, and overlapping bookings are refused on exact times by the database.
 */
export async function createRentalBooking(request: RentalRequest, now: Date = new Date()): Promise<CreateBookingResult> {
  // Only customers book (staff and people with a place or restaurant role don't).
  if (!(await isCustomer(request.guestId))) return { ok: false, error: "notCustomer" };
  const { guestId, listingId, unit, start, quantity, guests } = request;
  if (!BOOKING_UNITS.includes(unit) || !isRealDate(start) || start < todayISO(now)) return { ok: false, error: "invalid" };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY[unit] || !Number.isInteger(guests) || guests < 1) return { ok: false, error: "invalid" };
  const startTime = unit === "HOUR" ? (request.startTime ?? "") : null;
  if (unit === "HOUR" && !HHMM.test(startTime ?? "")) return { ok: false, error: "invalid" };

  const listing = await db.listing.findFirst({
    where: { id: listingId, status: "PUBLISHED" },
    select: {
      title: true,
      type: true,
      commissionBps: true,
      hostId: true,
      maxGuests: true,
      discountPercent: true,
      termsOfRent: true,
      bookingModel: true,
      rates: true,
      contractStart: true,
      contractEnd: true,
      availableFrom: true,
      availableUntil: true,
      workingDays: true,
    },
  });
  if (!listing) return { ok: false, error: "notFound" };
  if (listing.hostId === guestId) return { ok: false, error: "ownListing" };
  if (!unitsAllowedFor(listing.type).includes(unit)) return { ok: false, error: "notOffered" };
  const rate = listing.rates.find((r) => r.unit === unit) ?? null;
  const roomId = request.roomId ?? null;

  // What is being booked: the whole place at its rate for this unit, or one available room at the room's rate.
  let base: number;
  let room: { id: string; name: string; numbers: string[]; unitDetails: unknown; rates: { unit: string; price: number }[] } | null = null;
  // The rules for this unit: the room category's own when it has them, else the place's.
  let rules: { minUnits: number; maxUnits: number | null; dayStartTime: string | null; dayEndTime: string | null } | null = rate;
  let discount = listing.discountPercent;
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
    // Each rule the category leaves empty falls back to the place's.
    rules = {
      minUnits: roomRate.minUnits > 1 ? roomRate.minUnits : (rate?.minUnits ?? 1),
      maxUnits: roomRate.maxUnits ?? rate?.maxUnits ?? null,
      dayStartTime: roomRate.dayStartTime ?? rate?.dayStartTime ?? null,
      dayEndTime: roomRate.dayEndTime ?? rate?.dayEndTime ?? null,
    };
    if (found.discountPercent !== null) discount = found.discountPercent;
    // A room number the guest picked must be one of this type's rooms.
    if (request.roomNumber && !found.numbers.includes(request.roomNumber)) return { ok: false, error: "unavailable" };
    room = { id: found.id, name: found.name, numbers: found.numbers, unitDetails: found.unitDetails, rates: found.rates };
  }
  // Length and opening hours follow the place's rules for this unit (when set).
  if (rules && (quantity < rules.minUnits || (rules.maxUnits !== null && quantity > rules.maxUnits))) return { ok: false, error: "stayLength" };
  if (unit === "HOUR" && !withinHours(startTime!, quantity, rules?.dayStartTime ?? null, rules?.dayEndTime ?? null)) return { ok: false, error: "stayLength" };

  // Inside the management agreement and the place's own dates, starting on a working day.
  const span = periodFor(unit, start, quantity, startTime);
  // Hours that have already started can't be booked.
  if (unit === "HOUR" && span.startAt.getTime() < now.getTime()) return { ok: false, error: "pastTime" };
  // Numbered rooms each have their own price: the guest gets the room they picked, else the cheapest one free for
  // this time, and pays that room's price (it is then held for them).
  let roomNumber = request.roomNumber ?? null;
  if (room && room.numbers.length > 0) {
    const clashes = await db.booking.findMany({
      where: {
        listingId,
        startAt: { lt: span.endAt },
        endAt: { gt: span.startAt },
        OR: [{ roomId: room.id }, { roomId: null }],
        AND: [{ OR: [{ status: { in: ["CONFIRMED", "CHECKED_IN"] } }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }] }],
      },
      select: { roomId: true, roomNumber: true },
    });
    if (clashes.some((c) => c.roomId === null)) return { ok: false, error: "unavailable" };
    const taken = new Set(clashes.map((c) => c.roomNumber));
    const r = room;
    const free = r.numbers.filter((n) => !taken.has(n) && (priceOfRoom(r, n, unit) ?? 0) > 0).sort((a, b) => priceOfRoom(r, a, unit)! - priceOfRoom(r, b, unit)!);
    roomNumber = roomNumber ? (free.includes(roomNumber) ? roomNumber : null) : (free[0] ?? null);
    if (!roomNumber) return { ok: false, error: "unavailable" };
    base = priceOfRoom(r, roomNumber, unit)!;
  }
  if (!(base > 0)) return { ok: false, error: "notOffered" };
  const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
  const window = bookableWindow({
    contractStart: day(listing.contractStart),
    contractEnd: day(listing.contractEnd),
    availableFrom: day(listing.availableFrom),
    availableUntil: day(listing.availableUntil),
  });
  if (!insideWindow(span.checkIn, span.checkOut, window)) return { ok: false, error: "outsideWindow" };
  if (!onWorkingDays(unit, span.checkIn, span.checkOut, listing.workingDays)) return { ok: false, error: "closedDay" };

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

  const unitPrice = discountedPrice(base, discount);
  // Monthly: all chosen months now unless staff set fewer upfront. Everything else is paid in full.
  // Every chosen month is paid when booking (6 months: 6 now; 8: 8 now), plus any deposit.
  const paidUnits = quantity;
  // Deposit for long stays: a percent of one month's rent (a year's rent / 12).
  const monthRent = unit === "MONTH" ? unitPrice : unit === "YEAR" ? Math.round(unitPrice / 12) : 0;
  const deposit = long && settings.monthlyDepositPercent ? Math.round((monthRent * settings.monthlyDepositPercent) / 100) : 0;
  // The place's commission agreement in force now (a % or a fixed fee), else its category's rate; kept on the booking.
  const agreement = await agreementAt("PLACE", listingId, now);
  const fees = { ...feesFor(settings, listing.type, agreement?.percentBps ?? listing.commissionBps), fixedCommission: agreement?.fixedFee ?? null };
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
    roomNumbers: room?.numbers ?? [],
    preferredNumber: roomNumber,
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
      buyerTin: request.company?.tin ?? null,
      purchaseCode: request.company?.purchaseCode ?? null,
      policySnapshot,
      holdExpiresAt: new Date(now.getTime() + holdMinutesFrom(settings) * 60_000),
    },
  });
}

/** Nightly stay from check-in to checkout (the calendar on the listing page). */
export async function createBooking(request: BookingRequest, now: Date = new Date()): Promise<CreateBookingResult> {
  // Only customers book (staff and people with a place or restaurant role don't).
  if (!(await isCustomer(request.guestId))) return { ok: false, error: "notCustomer" };
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
  /** The room type's numbered rooms (a free one is given to the guest); empty = a single room. */
  roomNumbers?: string[];
  /** The room number the guest picked, if any (refused when someone holds it for this time). */
  preferredNumber?: string | null;
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
        const clashes = await tx.booking.findMany({
          where: {
            listingId,
            status: { in: [...BLOCKING_STATUSES] },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
            ...(roomId ? { OR: [{ roomId }, { roomId: null }] } : {}),
          },
          select: { roomId: true, roomNumber: true },
        });
        // A room type with numbered rooms: give the first number nobody holds for this time.
        const numbers = args.roomNumbers ?? [];
        let roomNumber: string | null = null;
        if (roomId && numbers.length > 0) {
          if (clashes.some((c) => c.roomId === null)) throw new Unavailable();
          const taken = new Set(clashes.map((c) => c.roomNumber));
          const wanted = args.preferredNumber ?? null;
          roomNumber = wanted ? (taken.has(wanted) ? null : wanted) : (numbers.find((n) => !taken.has(n)) ?? null);
          if (!roomNumber) throw new Unavailable();
        } else if (clashes.length > 0) throw new Unavailable();
        // Maintenance / unavailable / offline blocks: the whole place blocks everything; a room block blocks that room
        // (and a whole-place booking, which needs every room).
        const blocked = await tx.availabilityBlock.findFirst({
          where: {
            listingId,
            endedAt: null,
            startsAt: { lt: endAt },
            OR: [{ endsAt: null }, { endsAt: { gt: startAt } }],
            ...(roomId ? { roomId: { in: [roomId] } } : {}),
          },
          select: { id: true },
        });
        const wholeBlocked = roomId
          ? await tx.availabilityBlock.findFirst({
              where: { listingId, roomId: null, endedAt: null, startsAt: { lt: endAt }, OR: [{ endsAt: null }, { endsAt: { gt: startAt } }] },
              select: { id: true },
            })
          : null;
        if (blocked || wholeBlocked) throw new Unavailable();
        if (args.promoId && !(await claimPromoUse(tx, args.promoId))) throw new PromoGone();
        const created = await tx.booking.create({
          data: {
            ...args.data,
            reference,
            listingId,
            guestId,
            roomId,
            roomNumber,
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
  // Room types with several numbered rooms are only taken on days when every one of them is booked.
  const multi = new Map(
    (await db.room.findMany({ where: { listingId }, select: { id: true, numbers: true } })).filter((r) => r.numbers.length > 1).map((r) => [r.id, r.numbers.length]),
  );
  const blocks = await db.availabilityBlock.findMany({
    where: { listingId, endedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    select: { startsAt: true, endsAt: true, roomId: true },
  });
  // A block with no end shows as taken for the next two years (until someone ends it).
  const kigaliDay = (d: Date) => new Date(d.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const blockRanges = blocks.map((b) => {
    const end = b.endsAt ?? new Date(now.getTime() + 730 * 86_400_000);
    const endDay = kigaliDay(end);
    // A block ending mid-day still takes that day.
    const checkOut = end.getTime() + 2 * 60 * 60 * 1000 === Date.parse(`${endDay}T00:00:00Z`) ? endDay : asISO(new Date(Date.parse(`${endDay}T00:00:00Z`) + 86_400_000));
    return { checkIn: kigaliDay(b.startsAt), checkOut, roomId: b.roomId };
  });
  const singles = rows.filter((r) => !r.roomId || !multi.has(r.roomId)).map((r) => ({ checkIn: asISO(r.checkIn), checkOut: asISO(r.checkOut), roomId: r.roomId }));
  const full: (BookedRange & { roomId: string | null })[] = [];
  for (const [roomId, units] of multi) {
    const perDay = new Map<string, number>();
    for (const r of rows.filter((b) => b.roomId === roomId)) {
      for (let d = r.checkIn.getTime(); d < r.checkOut.getTime(); d += 86_400_000) {
        const key = new Date(d).toISOString().slice(0, 10);
        perDay.set(key, (perDay.get(key) ?? 0) + 1);
      }
    }
    // Merge the fully booked days into ranges.
    const days = [...perDay].filter(([, n]) => n >= units).map(([d]) => d).sort();
    for (const d of days) {
      const last = full.at(-1);
      const next = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      if (last && last.roomId === roomId && last.checkOut === d) last.checkOut = next;
      else full.push({ checkIn: d, checkOut: next, roomId });
    }
  }
  return [...singles, ...full, ...blockRanges];
}

const GUEST_SELECT = {
  reference: true,
  /** Whether the guest already wrote a review (to offer "Write a review" otherwise). */
  review: { select: { id: true } },
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
  // Checked out early: when, why, and the guest's appeal.
  checkedOutEarlyAt: true,
  earlyCheckoutReason: true,
  earlyCheckoutAppealAt: true,
  total: true,
  currency: true,
  room: { select: { name: true } },
  roomId: true,
  roomNumber: true,
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
/** More than this before the stay's end, a check-out is early (a reason is needed and the guest is told). */
const EARLY_GRACE_MS = 60 * 60 * 1000;

export async function staffMoveBooking(
  staffId: string,
  reference: string,
  to: "CHECKED_IN" | "COMPLETED",
  now: Date = new Date(),
  /** Checking out before the stay's end: why (the guest reads it). */
  reason = "",
): Promise<boolean> {
  const why = reason.trim().slice(0, 300);
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { reference }, select: { id: true, status: true, checkIn: true, endAt: true, guestId: true, listing: { select: { title: true } } } });
    if (!booking || !canTransition(booking.status, to)) return false;
    if (to === "CHECKED_IN" && asISO(booking.checkIn) > todayISO(now)) return false;
    // Before the stay's end: an early check-out, only with a reason (kept, and told to the guest).
    const early = to === "COMPLETED" && booking.endAt.getTime() - now.getTime() > EARLY_GRACE_MS;
    if (early && !why) return false;
    const { count } = await tx.booking.updateMany({
      where: { id: booking.id, status: booking.status },
      data: { status: to, ...(early ? { checkedOutEarlyAt: now, earlyCheckoutById: staffId, earlyCheckoutReason: why, earlyCheckoutAppeal: null, earlyCheckoutAppealAt: null } : {}) },
    });
    if (count !== 1) return false;
    await tx.bookingEvent.create({
      data: { bookingId: booking.id, fromStatus: booking.status, toStatus: to, actorId: staffId, reason: to === "CHECKED_IN" ? "checked in" : early ? `checked out early: ${why}` : "checked out" },
    });
    await audit(tx, { actorId: staffId, action: to === "CHECKED_IN" ? "booking.checkIn" : early ? "booking.checkOutEarly" : "booking.checkOut", entityType: "booking", entityId: reference, ...(early ? { data: { reason: why } } : {}) });
    if (early) await notify(tx, booking.guestId, "checkedOutEarly", { reference, title: booking.listing.title, reason: why }, `/bookings/${reference}`);
    if (to === "COMPLETED") {
      await maybeCreateReward(tx, booking.id);
      await maybePromoterReward(tx, booking.id, now);
    }
    return true;
  });
}

/** An early check-out undone (VIIPA or the place's team): the guest is checked in again for the rest of their stay. */
export async function undoEarlyCheckout(actorId: string, reference: string, now: Date = new Date()): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { reference }, select: { id: true, status: true, endAt: true, checkedOutEarlyAt: true, guestId: true, listing: { select: { title: true } } } });
    if (!booking || booking.status !== "COMPLETED" || !booking.checkedOutEarlyAt || booking.endAt <= now) return false;
    const { count } = await tx.booking.updateMany({ where: { id: booking.id, status: "COMPLETED" }, data: { status: "CHECKED_IN", checkedOutEarlyAt: null, earlyCheckoutById: null, earlyCheckoutReason: null } });
    if (count !== 1) return false;
    await tx.bookingEvent.create({ data: { bookingId: booking.id, fromStatus: "COMPLETED", toStatus: "CHECKED_IN", actorId, reason: "early check-out undone" } });
    await audit(tx, { actorId, action: "booking.undoEarlyCheckout", entityType: "booking", entityId: reference });
    await notify(tx, booking.guestId, "checkInRestored", { reference, title: booking.listing.title }, `/bookings/${reference}`);
    return true;
  });
}

/** The guest disagrees with an early check-out: their appeal goes to VIIPA and the place's team. */
export async function appealEarlyCheckout(guestId: string, reference: string, text: string, now: Date = new Date()): Promise<boolean> {
  const appeal = text.trim().slice(0, 1000);
  if (appeal.length < 5) return false;
  const booking = await db.booking.findFirst({
    where: { reference, guestId, status: "COMPLETED", checkedOutEarlyAt: { not: null }, earlyCheckoutAppealAt: null },
    select: { id: true, listing: { select: { hostId: true, title: true, team: { where: { role: { in: ["MANAGER", "RECEPTIONIST"] } }, select: { userId: true } } } } },
  });
  if (!booking) return false;
  await db.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: booking.id }, data: { earlyCheckoutAppeal: appeal, earlyCheckoutAppealAt: now } });
    await audit(tx, { actorId: guestId, action: "booking.earlyCheckoutAppeal", entityType: "booking", entityId: reference });
    const { notifyAdmins } = await import("@/features/notifications/service");
    await notifyAdmins(tx, "earlyCheckoutAppeal", { reference, title: booking.listing.title }, `/admin/bookings/${reference}`);
    for (const userId of new Set([booking.listing.hostId, ...booking.listing.team.map((m) => m.userId)])) await notify(tx, userId, "earlyCheckoutAppeal", { reference, title: booking.listing.title }, "/host/bookings");
  });
  return true;
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

/**
 * Checks guests out on their own once their stay's end time has passed (checked in, not yet out): the same as the
 * front desk checking them out, logged by the system, and the guest is told. Runs with the daily job and whenever the
 * front desk, the guest's stay or the staff bookings are opened. Gives back how many were checked out.
 */
export async function autoCheckOut(now: Date = new Date()): Promise<number> {
  const due = await db.booking.findMany({ where: { status: "CHECKED_IN", endAt: { lte: now } }, select: { id: true, reference: true, guestId: true, listing: { select: { title: true } } }, take: 200 });
  let done = 0;
  for (const b of due) {
    const ok = await db.$transaction(async (tx) => {
      const { count } = await tx.booking.updateMany({ where: { id: b.id, status: "CHECKED_IN" }, data: { status: "COMPLETED" } });
      if (count !== 1) return false;
      await tx.bookingEvent.create({ data: { bookingId: b.id, fromStatus: "CHECKED_IN", toStatus: "COMPLETED", actorId: null, reason: "checked out automatically (stay ended)" } });
      await audit(tx, { actorId: null, action: "booking.autoCheckOut", entityType: "booking", entityId: b.reference });
      await maybeCreateReward(tx, b.id);
      await maybePromoterReward(tx, b.id, now);
      await notify(tx, b.guestId, "bookingCheckedOut", { title: b.listing.title, reference: b.reference }, `/bookings/${b.reference}`);
      return true;
    });
    if (ok) done++;
  }
  return done;
}

/** Background job: releases every unpaid hold past its time (they are also released whenever a place is booked). */
export async function expireAllHolds(now: Date = new Date()): Promise<number> {
  const before = await db.booking.count({ where: { status: "PENDING_PAYMENT", holdExpiresAt: { lte: now } } });
  if (before > 0) await db.$transaction((tx) => expireHolds(tx, {}, now));
  return before;
}

/** Days each numbered room is taken from today on (paid stays and live holds), for picking a specific room. */
export async function bookedRoomNumbers(listingId: string, now: Date = new Date()): Promise<{ roomId: string; roomNumber: string; checkIn: ISODate; checkOut: ISODate }[]> {
  const rows = await db.booking.findMany({
    where: {
      listingId,
      roomNumber: { not: null },
      checkOut: { gt: asDate(todayISO(now)) },
      OR: [{ status: { in: ["CONFIRMED", "CHECKED_IN"] } }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }],
    },
    select: { roomId: true, roomNumber: true, checkIn: true, checkOut: true },
  });
  return rows.map((r) => ({ roomId: r.roomId!, roomNumber: r.roomNumber!, checkIn: asISO(r.checkIn), checkOut: asISO(r.checkOut) }));
}

/**
 * One room's taken days from today on (for its own calendar): its own bookings (that room number, or the room
 * type when it has no numbers), whole-place bookings, and blocks on the room type or the whole place.
 */
export async function bookedForRoom(listingId: string, roomId: string, roomNumber: string | null, now: Date = new Date()): Promise<(BookedRange & { roomId: string | null })[]> {
  const all = await bookedRanges(listingId, now);
  const own = await db.booking.findMany({
    where: {
      listingId,
      roomId,
      checkOut: { gt: asDate(todayISO(now)) },
      AND: [
        ...(roomNumber ? [{ OR: [{ roomNumber }, { roomNumber: null }] }] : []),
        { OR: [{ status: { in: ["CONFIRMED" as const, "CHECKED_IN" as const] } }, { status: "PENDING_PAYMENT" as const, holdExpiresAt: { gt: now } }] },
      ],
    },
    select: { checkIn: true, checkOut: true },
  });
  // Whole-place bookings and blocks, the room type's blocks (and days all its rooms are taken), plus this room's own.
  return [...all.filter((r) => r.roomId === null || r.roomId === roomId), ...own.map((b) => ({ checkIn: asISO(b.checkIn), checkOut: asISO(b.checkOut), roomId }))];
}
