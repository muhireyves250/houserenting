import type { ISODate } from "@/features/search/date-range";
import type { BookingStatus } from "./status";

const utc = (iso: ISODate) => new Date(`${iso}T00:00:00Z`);

/** "Oct 20 – 23, 2026" */
export function formatStayDates(locale: string, checkIn: ISODate, checkOut: ISODate): string {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).formatRange(utc(checkIn), utc(checkOut));
}

/** "Tue, Oct 20, 2026" */
export function formatDay(locale: string, day: ISODate): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(utc(day));
}

/** Clock time in Rwanda, e.g. "14:35". */
export function formatKigaliTime(locale: string, at: Date): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" }).format(at);
}

export function formatKigaliDateTime(locale: string, at: Date): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Kigali" }).format(at);
}

/** Google Maps directions to a place (opens the Maps app on phones). */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export const STATUS_TONE: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "bg-amber-50 text-amber-800 ring-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CHECKED_IN: "bg-primary/[0.08] text-primary ring-primary/20",
  COMPLETED: "bg-canvas text-ink/80 ring-line",
  CANCELLED: "bg-canvas text-muted ring-line",
  EXPIRED: "bg-canvas text-muted ring-line",
  NO_SHOW: "bg-red-50 text-red-800 ring-red-200",
};
