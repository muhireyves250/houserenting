import type { DateRange } from "@/features/search/date-range";
import { discountedPrice, type Rate } from "./pricing";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Nights between check-in and checkout (0 until both are chosen). */
export function nightsBetween({ checkIn, checkOut }: DateRange): number {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / DAY_MS));
}

export type StayQuote = { nights: number; nightly: number; total: number; originalTotal: number | null };

/** Price of the chosen nights at the nightly rate (after discount); null without dates or a nightly rate. */
export function stayQuote(rates: Rate[], discountPercent: number | null, range: DateRange): StayQuote | null {
  const night = rates.find((r) => r.unit === "NIGHT");
  const nights = nightsBetween(range);
  if (!night || nights === 0) return null;
  const nightly = discountedPrice(night.price, discountPercent);
  return { nights, nightly, total: nightly * nights, originalTotal: nightly === night.price ? null : night.price * nights };
}
