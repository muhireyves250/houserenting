import { BOOKING_UNITS, type BookingUnit } from "./period";
import type { BookedRange, DateRange, ISODate } from "@/features/search/date-range";

/** "Book again": the same guests, way of booking and length as an earlier booking, on the soonest free dates. */
export type Again = { guests: number; unit: BookingUnit; length: number };
/** What the booking card starts with when booking again (dates for nights, a start day for the rest). */
export type AgainStart = { guests: number; unit: BookingUnit; range: DateRange; plan: { start: string; quantity: number; startTime: string } | null };

/** The link part for an earlier booking: `?again=guests.unit.length`. */
export function againParam(b: { guests: number; unit: string; nights: number; quantity: number }): string {
  return `${b.guests}.${b.unit}.${b.unit === "NIGHT" ? b.nights : b.quantity}`;
}

export function parseAgain(value: unknown): Again | null {
  if (typeof value !== "string") return null;
  const [g, unit, n] = value.split(".");
  const guests = Number(g);
  const length = Number(n);
  if (!BOOKING_UNITS.includes(unit as BookingUnit) || !Number.isInteger(guests) || !Number.isInteger(length)) return null;
  if (guests < 1 || guests > 50 || length < 1 || length > 366) return null;
  return { guests, unit: unit as BookingUnit, length };
}

const addDays = (day: ISODate, n: number): ISODate => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * The soonest stay of `nights` nights from today that doesn't touch a booked night of this choice (the whole place,
 * or a room plus whole-place bookings), looking a year ahead.
 */
export function soonestFree(booked: (BookedRange & { roomId?: string | null })[], roomId: string | null, nights: number, today: ISODate): DateRange {
  const taken = roomId ? booked.filter((b) => !b.roomId || b.roomId === roomId) : booked;
  for (let i = 0; i < 366; i++) {
    const checkIn = addDays(today, i);
    const checkOut = addDays(checkIn, nights);
    if (!taken.some((b) => checkIn < b.checkOut && b.checkIn < checkOut)) return { checkIn, checkOut };
  }
  return {};
}

/** What to start the booking card with for "Book again". */
export function againStart(again: Again | null, booked: (BookedRange & { roomId?: string | null })[], roomId: string | null, today: ISODate): AgainStart | null {
  if (!again) return null;
  if (again.unit === "NIGHT") return { guests: again.guests, unit: "NIGHT", range: soonestFree(booked, roomId, again.length, today), plan: null };
  // Hours need a start time picked; other ways start on the first free day.
  const start = again.unit === "HOUR" ? "" : (soonestFree(booked, roomId, 1, today).checkIn ?? "");
  return { guests: again.guests, unit: again.unit, range: {}, plan: { start, quantity: again.length, startTime: "" } };
}
