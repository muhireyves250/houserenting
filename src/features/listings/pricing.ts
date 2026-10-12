import type { SearchMode } from "@/features/search/params";

export type Unit = "HOUR" | "DAY" | "NIGHT" | "MONTH";
export type Rate = { unit: Unit; price: number };

const SHORT_PREFERENCE: Unit[] = ["NIGHT", "DAY", "HOUR"];
const NEW_FOR_MS = 14 * 24 * 60 * 60 * 1000;

/** The rate shown on cards: nightly → daily → hourly for short stays, monthly for long stays. */
export function headlineRate<R extends Rate>(rates: R[], mode: SearchMode): R | undefined {
  const order = mode === "long" ? (["MONTH"] as Unit[]) : SHORT_PREFERENCE;
  for (const unit of order) {
    const rate = rates.find((r) => r.unit === unit);
    if (rate) return rate;
  }
  return undefined;
}

export function discountedPrice(price: number, discountPercent: number | null | undefined): number {
  if (!discountPercent || discountPercent <= 0 || discountPercent >= 100) return price;
  return Math.round((price * (100 - discountPercent)) / 100);
}

export function isNewListing(publishedAt: Date | null, now: Date = new Date()): boolean {
  return publishedAt !== null && now.getTime() - publishedAt.getTime() <= NEW_FOR_MS;
}

export function rentalModes(rates: Rate[]): { short: boolean; long: boolean } {
  return {
    short: rates.some((r) => SHORT_PREFERENCE.includes(r.unit)),
    long: rates.some((r) => r.unit === "MONTH"),
  };
}
