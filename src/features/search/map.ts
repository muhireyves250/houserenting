import { discountedPrice, headlineRate, SAMPLE_NIGHTS, type Rate } from "@/features/listings/pricing";
import type { SearchMode } from "./params";

/** Whole of Rwanda, for when there is nothing to frame. */
export const RWANDA_CENTER: [number, number] = [-1.94, 29.87];

/** Short price for a map pin: "RWF 45K", "RWF 2.5M". */
export function pinLabel(amount: number, locale: string): string {
  return `RWF ${new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(amount)}`;
}

/** The price a pin shows, matching the card: nightly rates priced for SAMPLE_NIGHTS, others per unit; after discount. */
export function pinPrice(listing: { rates: Rate[]; discountPercent: number | null }, mode: SearchMode): { amount: number; unit: Rate["unit"] } | null {
  const rate = headlineRate(listing.rates, mode) ?? listing.rates[0];
  if (!rate) return null;
  const amount = discountedPrice(rate.price, listing.discountPercent);
  return { amount: rate.unit === "NIGHT" ? amount * SAMPLE_NIGHTS : amount, unit: rate.unit };
}

/** South-west and north-east corners that frame every place, or null when there are none. */
export function resultsBounds(points: { lat: number; lng: number }[]): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}
