import type { ISODate } from "@/features/search/date-range";
import { addMonthsISO } from "./monthly";

export const BOOKING_UNITS = ["HOUR", "DAY", "NIGHT", "WEEK", "MONTH", "YEAR"] as const;
export type BookingUnit = (typeof BOOKING_UNITS)[number];

/** Units a lodge may offer: by the night or by the day. */
export const LODGE_UNITS: readonly BookingUnit[] = ["NIGHT", "DAY"];
/** Long stays (moving in): deposits and upfront rules apply. */
export const LONG_UNITS: readonly BookingUnit[] = ["MONTH", "YEAR"];

export function unitsAllowedFor(type: string): readonly BookingUnit[] {
  return type === "LODGE" ? LODGE_UNITS : BOOKING_UNITS;
}

// Rwanda is UTC+2 all year (no daylight saving).
const KIGALI = "+02:00";
const DAY_MS = 24 * 60 * 60 * 1000;

const addDaysISO = (iso: ISODate, days: number): ISODate => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const kigaliMidnight = (iso: ISODate) => new Date(`${iso}T00:00:00${KIGALI}`);

export type Period = {
  /** Exact time the place is taken from, and until (end not included). */
  startAt: Date;
  endAt: Date;
  /** Calendar days for lists and the receipt (checkOut is the first free day). */
  checkIn: ISODate;
  checkOut: ISODate;
};

/**
 * When a booking holds the place: `quantity` hours from `startTime`, or days/nights/weeks/months/years from `start`.
 * Day-based bookings run midnight to midnight (Kigali time); a checkout day stays free for the next guest's check-in.
 */
export function periodFor(unit: BookingUnit, start: ISODate, quantity: number, startTime: string | null = null): Period {
  if (unit === "HOUR") {
    const startAt = new Date(`${start}T${startTime ?? "00:00"}:00${KIGALI}`);
    return { startAt, endAt: new Date(startAt.getTime() + quantity * 60 * 60 * 1000), checkIn: start, checkOut: addDaysISO(start, 1) };
  }
  const end =
    unit === "WEEK"
      ? addDaysISO(start, 7 * quantity)
      : unit === "MONTH"
        ? addMonthsISO(start, quantity)
        : unit === "YEAR"
          ? addMonthsISO(start, 12 * quantity)
          : addDaysISO(start, quantity);
  return { startAt: kigaliMidnight(start), endAt: kigaliMidnight(end), checkIn: start, checkOut: end };
}

/** Whether an hourly booking fits the opening hours (when the host set them). */
export function withinHours(startTime: string, hours: number, open: string | null, close: string | null): boolean {
  const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  const from = minutes(startTime);
  const to = from + hours * 60;
  if (to > 24 * 60) return false;
  return (!open || from >= minutes(open)) && (!close || to <= minutes(close));
}
