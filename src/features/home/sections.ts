import type { ListingCardData } from "@/features/listings/service";
import type { SearchMode } from "@/features/search/params";

export type HomeSectionKey = "kigali" | "volcanoes" | "kivu" | "long";

export type HomeSection = {
  key: HomeSectionKey;
  /** Which price to show on cards: per night/day/hour for short stays, per month for long stays. */
  mode: SearchMode;
  /** Search the row title links to. */
  query: Record<string, string>;
  listings: ListingCardData[];
};

const ROW_LIMIT = 10;

const ROWS: { key: HomeSectionKey; mode: SearchMode; query: Record<string, string>; match: (l: ListingCardData) => boolean }[] = [
  { key: "kigali", mode: "short", query: { mode: "short", location: "Kigali" }, match: (l) => l.city === "Kigali" },
  { key: "volcanoes", mode: "short", query: { mode: "short", location: "Musanze" }, match: (l) => l.city === "Musanze" },
  { key: "kivu", mode: "short", query: { mode: "short", location: "Kivu" }, match: (l) => l.city === "Rubavu" || l.city === "Karongi" },
  { key: "long", mode: "long", query: { mode: "long" }, match: (l) => l.rates.some((r) => r.unit === "MONTH") },
];

/** Groups homes into the home page's themed rows (in order), skipping empty rows. */
export function buildHomeSections(listings: ListingCardData[]): HomeSection[] {
  return ROWS.map(({ match, ...row }) => ({ ...row, listings: listings.filter(match).slice(0, ROW_LIMIT) })).filter(
    (row) => row.listings.length > 0,
  );
}

/** "Guest favorite" badge: highly rated by enough guests. */
export function isGuestFavorite({ ratingAvg, ratingCount }: { ratingAvg: number; ratingCount: number }): boolean {
  return ratingAvg >= 4.8 && ratingCount >= 20;
}
