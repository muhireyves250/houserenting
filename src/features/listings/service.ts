import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { SearchQuery } from "@/features/search/params";
import { db } from "@/lib/db";

const SHORT_UNITS = ["HOUR", "DAY", "NIGHT", "WEEK"] as const;
const LONG_UNITS = ["MONTH", "YEAR"] as const;
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

export function searchListings(query: SearchQuery, limit = SEARCH_LIMIT, now: Date = new Date()): Promise<ListingCardData[]> {
  // A place qualifies through any rate for the mode; the price range applies to that same rate.
  const price = query.minPrice || query.maxPrice ? { gte: query.minPrice, lte: query.maxPrice } : undefined;
  const where: Prisma.ListingWhereInput = {
    status: "PUBLISHED",
    rates: { some: { unit: { in: query.mode === "long" ? [...LONG_UNITS] : [...SHORT_UNITS] }, price } },
  };
  if (query.types?.length) where.type = { in: query.types };
  if (query.bbox) {
    const [south, west, north, east] = query.bbox;
    where.lat = { gte: south, lte: north };
    where.lng = { gte: west, lte: east };
  }
  if (query.location) {
    // Prisma's `contains` becomes ILIKE '%…%' without escaping, so escape LIKE wildcards ourselves.
    const match = { contains: escapeLike(query.location), mode: "insensitive" } as const;
    where.OR = [{ city: match }, { district: match }, { title: match }];
  }
  if (query.guests) where.maxGuests = { gte: query.guests };
  if (query.pets) where.petsAllowed = true;
  if (query.bedrooms) where.bedrooms = { gte: query.bedrooms };
  if (query.amenities?.length) where.facilities = { hasEvery: query.amenities };

  // Exact dates: only places free on those nights that take a stay of that length.
  if (query.mode === "short" && query.checkIn && query.checkOut && !query.flex) {
    const checkIn = new Date(`${query.checkIn}T00:00:00Z`);
    const checkOut = new Date(`${query.checkOut}T00:00:00Z`);
    const nights = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);
    const overlap: Prisma.BookingWhereInput = {
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      OR: [{ status: { in: ["CONFIRMED", "CHECKED_IN"] } }, { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } }],
    };
    // Free if the whole place is (whole-place bookings), or if some available room is (room-by-room places).
    const free: Prisma.ListingWhereInput[] = [
      { bookingModel: { in: ["WHOLE_PROPERTY", "BOTH"] }, bookings: { none: overlap } },
      {
        bookingModel: { in: ["ROOM_BY_ROOM", "BOTH"] },
        bookings: { none: { ...overlap, roomId: null } },
        roomUnits: { some: { status: "AVAILABLE", bookings: { none: overlap } } },
      },
    ];
    where.AND = [
      { OR: free },
      { rates: { some: { unit: "NIGHT", minUnits: { lte: nights }, OR: [{ maxUnits: null }, { maxUnits: { gte: nights } }] } } },
    ];
  }

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

/** The published listing a "/listings/<id>[-words]" link points to: the longest candidate ID that exists wins. */
export async function getPublishedListingByParam(candidates: string[]) {
  if (candidates.length === 0) return null;
  const found = await db.listing.findMany({ where: { id: { in: candidates.slice(0, 20) }, status: "PUBLISHED" }, select: { id: true } });
  const id = candidates.find((c) => found.some((f) => f.id === c));
  return id ? getPublishedListing(id) : null;
}

export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getPublishedListing>>>;

// ~65 km around a place: wide enough for a district, narrow enough to stay "nearby".
const NEARBY_DEGREES = 0.6;

/** Other published places around this one, closest first. */
export async function nearbyListings(place: { id: string; lat: number; lng: number }, limit = 8): Promise<ListingCardData[]> {
  const candidates = await db.listing.findMany({
    where: {
      status: "PUBLISHED",
      id: { not: place.id },
      lat: { gte: place.lat - NEARBY_DEGREES, lte: place.lat + NEARBY_DEGREES },
      lng: { gte: place.lng - NEARBY_DEGREES, lte: place.lng + NEARBY_DEGREES },
    },
    select: CARD_SELECT,
    take: 60,
  });
  const distance = (l: { lat: number; lng: number }) => (l.lat - place.lat) ** 2 + ((l.lng - place.lng) * Math.cos((place.lat * Math.PI) / 180)) ** 2;
  return candidates.sort((a, b) => distance(a) - distance(b)).slice(0, limit);
}
