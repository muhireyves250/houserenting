import type { ISODate } from "@/features/search/date-range";
import type { BookingUnit } from "./period";

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (iso: ISODate, days: number): ISODate => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const weekday = (iso: ISODate) => new Date(`${iso}T00:00:00Z`).getUTCDay();
const later = (a?: ISODate | null, b?: ISODate | null) => (!a ? (b ?? undefined) : !b ? a : a > b ? a : b);
const earlier = (a?: ISODate | null, b?: ISODate | null) => (!a ? (b ?? undefined) : !b ? a : a < b ? a : b);

export type Window = { from?: ISODate; until?: ISODate };

/** When a place may be booked: inside its management agreement and its own start/end dates (both inclusive). */
export function bookableWindow(place: { contractStart?: ISODate | null; contractEnd?: ISODate | null; availableFrom?: ISODate | null; availableUntil?: ISODate | null }): Window {
  return { from: later(place.contractStart, place.availableFrom), until: earlier(place.contractEnd, place.availableUntil) };
}

/** A stay from checkIn to checkOut (checkout morning) must start on/after `from` and end by the day after `until`. */
export function insideWindow(checkIn: ISODate, checkOut: ISODate, window: Window): boolean {
  if (window.from && checkIn < window.from) return false;
  if (window.until && checkOut > addDays(window.until, 1)) return false;
  return true;
}

/**
 * Working days (0 = Sunday … 6; empty = every day). Stays start on a working day; hourly and daily bookings use
 * every day they cover, so each of those must be a working day.
 */
export function onWorkingDays(unit: BookingUnit, checkIn: ISODate, checkOut: ISODate, workingDays: readonly number[]): boolean {
  if (workingDays.length === 0) return true;
  if (unit !== "HOUR" && unit !== "DAY") return workingDays.includes(weekday(checkIn));
  for (let day = checkIn; day < checkOut; day = addDays(day, 1)) if (!workingDays.includes(weekday(day))) return false;
  return true;
}

/** Calendar helper: a day that can't be booked because of the window or working days. */
export function dayClosed(day: ISODate, window: Window, workingDays: readonly number[]): boolean {
  if (window.from && day < window.from) return true;
  if (window.until && day > window.until) return true;
  return workingDays.length > 0 && !workingDays.includes(weekday(day));
}

/** Whole days left until a contract ends (negative once it has ended). */
export function daysUntil(end: ISODate, today: ISODate): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}
