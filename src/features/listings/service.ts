import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { SearchQuery } from "@/features/search/params";
import { db } from "@/lib/db";

const SHORT_UNITS = ["HOUR", "DAY", "NIGHT"] as const;
const SEARCH_LIMIT = 24;

export const CARD_SELECT = {
  id: true,
  title: true,
  type: true,
  city: true,
  district: true,
  maxGuests: true,
  bedrooms: true,
  bathrooms: true,
  lat: true,
  lng: true,
  discountPercent: true,
  ratingAvg: true,
  ratingCount: true,
  publishedAt: true,
  // Cover plus the next photo, which cards slide to on hover.
  photos: { orderBy: { position: "asc" }, take: 2, select: { url: true, width: true, height: true } },
  rates: { select: { unit: true, price: true } },
} satisfies Prisma.ListingSelect;

export type ListingCardData = Prisma.ListingGetPayload<{ select: typeof CARD_SELECT }>;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function searchListings(query: SearchQuery, limit = SEARCH_LIMIT): Promise<ListingCardData[]> {
  // A place qualifies through any rate for the mode; the price range applies to that same rate.
  const price = query.minPrice || query.maxPrice ? { gte: query.minPrice, lte: query.maxPrice } : undefined;
  const where: Prisma.ListingWhereInput = {
    status: "PUBLISHED",
    rates: { some: { unit: query.mode === "long" ? "MONTH" : { in: [...SHORT_UNITS] }, price } },
  };
  if (query.types?.length) where.type = { in: query.types };
  if (query.location) {
    // Prisma's `contains` becomes ILIKE '%…%' without escaping, so escape LIKE wildcards ourselves.
    const match = { contains: escapeLike(query.location), mode: "insensitive" } as const;
    where.OR = [{ city: match }, { district: match }, { title: match }];
  }
  if (query.guests) where.maxGuests = { gte: query.guests };
  if (query.pets) where.petsAllowed = true;

  return db.listing.findMany({ where, select: CARD_SELECT, orderBy: [{ publishedAt: "desc" }, { id: "asc" }], take: limit });
}

export type LocationSuggestion = { city: string; count: number; photo: string | null };

/** Cities that have published places, optionally filtered by typed text (city or district). */
export async function suggestLocations(text: string, limit = 6): Promise<LocationSuggestion[]> {
  const where: Prisma.ListingWhereInput = { status: "PUBLISHED" };
  const q = text.trim().slice(0, 100);
  if (q) {
    const match = { contains: escapeLike(q), mode: "insensitive" } as const;
    where.OR = [{ city: match }, { district: match }];
  }
  const groups = await db.listing.groupBy({
    by: ["city"],
    where,
    _count: { _all: true },
    orderBy: [{ _count: { city: "desc" } }, { city: "asc" }],
    take: limit,
  });
  // Cover photo per city: first photo of its newest published listing (one query for all cities).
  const newest = await db.listing.findMany({
    where: { status: "PUBLISHED", city: { in: groups.map((g) => g.city) } },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    select: { city: true, photos: { orderBy: { position: "asc" }, take: 1, select: { url: true } } },
  });
  const cover = new Map<string, string>();
  for (const listing of newest) {
    if (!cover.has(listing.city) && listing.photos[0]) cover.set(listing.city, listing.photos[0].url);
  }
  return groups.map((g) => ({ city: g.city, count: g._count._all, photo: cover.get(g.city) ?? null }));
}

export function featuredListings(limit = 6): Promise<ListingCardData[]> {
  return db.listing.findMany({
    where: { status: "PUBLISHED" },
    select: CARD_SELECT,
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: limit,
  });
}

export function getPublishedListing(id: string) {
  return db.listing.findFirst({
    where: { id, status: "PUBLISHED" },
    include: {
      photos: { orderBy: { position: "asc" } },
      rates: true,
      host: { select: { name: true, createdAt: true } },
    },
  });
}

export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getPublishedListing>>>;
