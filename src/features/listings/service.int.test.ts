import { beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { featuredListings, getPublishedListing, nearbyListings, searchListings, suggestLocations } from "./service";

let n = 0;
async function listing(overrides: Partial<Prisma.ListingUncheckedCreateInput> = {}, units: ("HOUR" | "DAY" | "NIGHT" | "MONTH")[] = ["NIGHT"]) {
  n += 1;
  return db.listing.create({
    data: {
      hostId: "host",
      title: `Flat ${n}`,
      description: "Nice place",
      type: "APARTMENT",
      status: "PUBLISHED",
      publishedAt: new Date(Date.UTC(2026, 9, n)),
      addressLine: "KG 7 Ave",
      district: "Gasabo",
      city: "Kigali",
      lat: -1.95,
      lng: 30.06,
      sizeM2: 80,
      rooms: 3,
      bedrooms: 2,
      bathrooms: 1,
      maxGuests: 4,
      ...overrides,
      photos: { create: [{ url: `https://images.unsplash.com/p${n}`, publicId: `p${n}`, width: 1200, height: 800, position: 0 }] },
      rates: { create: units.map((unit) => ({ unit, price: unit === "MONTH" ? 900000 : 45000 })) },
    },
  });
}

beforeEach(async () => {
  await resetDb();
  n = 0;
  await db.user.create({ data: { id: "host", name: "Sabrina Ghilaci", email: "host@example.com", isHost: true } });
});

describe("searchListings", () => {
  it("returns only published listings, newest first", async () => {
    const older = await listing();
    const newer = await listing();
    await listing({ status: "DRAFT" });
    await listing({ status: "PENDING_REVIEW" });
    const results = await searchListings({ mode: "short" });
    expect(results.map((r) => r.id)).toEqual([newer.id, older.id]);
  });

  it("filters by mode using the listing's rate units", async () => {
    const nightly = await listing({}, ["NIGHT"]);
    const hourly = await listing({}, ["HOUR"]);
    const monthly = await listing({}, ["MONTH"]);
    const both = await listing({}, ["DAY", "MONTH"]);
    expect((await searchListings({ mode: "short" })).map((r) => r.id).sort()).toEqual([nightly.id, hourly.id, both.id].sort());
    expect((await searchListings({ mode: "long" })).map((r) => r.id).sort()).toEqual([monthly.id, both.id].sort());
  });

  it("matches location against city, district or title, ignoring case", async () => {
    const kigali = await listing({ city: "Kigali", district: "Gasabo" });
    const musanze = await listing({ city: "Musanze", district: "Musanze", title: "Lodge near Volcanoes" });
    expect((await searchListings({ mode: "short", location: "kigali" })).map((r) => r.id)).toEqual([kigali.id]);
    expect((await searchListings({ mode: "short", location: "GASABO" })).map((r) => r.id)).toEqual([kigali.id]);
    expect((await searchListings({ mode: "short", location: "volcanoes" })).map((r) => r.id)).toEqual([musanze.id]);
  });

  it("only returns places that fit the number of guests", async () => {
    const small = await listing({ maxGuests: 2 });
    const big = await listing({ maxGuests: 8 });
    expect((await searchListings({ mode: "short", guests: 4 })).map((r) => r.id)).toEqual([big.id]);
    expect((await searchListings({ mode: "short", guests: 2 })).map((r) => r.id).sort()).toEqual([small.id, big.id].sort());
  });

  it("includes the cover photo and rates for cards", async () => {
    await listing({}, ["NIGHT", "MONTH"]);
    const [card] = await searchListings({ mode: "short" });
    expect(card.photos).toHaveLength(1);
    expect(card.rates.map((r) => r.unit).sort()).toEqual(["MONTH", "NIGHT"]);
  });

  it("treats LIKE wildcards in the location as plain text", async () => {
    await listing({ city: "Kigali" });
    expect(await searchListings({ mode: "short", location: "%" })).toEqual([]);
  });
});

describe("featuredListings", () => {
  it("returns the newest published listings up to the limit", async () => {
    await listing();
    const b = await listing();
    const c = await listing();
    await listing({ status: "DRAFT" });
    expect((await featuredListings(2)).map((r) => r.id)).toEqual([c.id, b.id]);
  });
});

describe("getPublishedListing", () => {
  it("returns full details with ordered photos, rates and public host info", async () => {
    const created = await listing({}, ["NIGHT", "HOUR"]);
    await db.listingPhoto.create({ data: { listingId: created.id, url: "https://images.unsplash.com/second", publicId: "s", width: 1, height: 1, position: 1 } });
    const found = await getPublishedListing(created.id);
    expect(found?.photos.map((p) => p.position)).toEqual([0, 1]);
    expect(found?.rates).toHaveLength(2);
    expect(found?.host).toEqual({ name: "Sabrina Ghilaci", createdAt: expect.any(Date) });
  });

  it("hides unpublished or unknown listings", async () => {
    const draft = await listing({ status: "DRAFT" });
    expect(await getPublishedListing(draft.id)).toBeNull();
    expect(await getPublishedListing("does-not-exist")).toBeNull();
  });
});

describe("pets filter", () => {
  it("only returns pet-friendly places when pets are coming", async () => {
    const friendly = await listing({ petsAllowed: true });
    await listing({ petsAllowed: false });
    expect((await searchListings({ mode: "short", pets: 1 })).map((r) => r.id)).toEqual([friendly.id]);
  });
});

describe("suggestLocations", () => {
  beforeEach(async () => {
    await listing({ city: "Kigali" });
    await listing({ city: "Kigali" });
    await listing({ city: "Musanze", district: "Musanze" });
    await listing({ city: "Rubavu", district: "Rubavu", status: "DRAFT" });
  });

  it("lists cities with published places, most places first, with a cover photo", async () => {
    const suggestions = await suggestLocations("");
    expect(suggestions.map(({ city, count }) => ({ city, count }))).toEqual([
      { city: "Kigali", count: 2 },
      { city: "Musanze", count: 1 },
    ]);
    // Cover = first photo of the newest published listing in that city.
    expect(suggestions[0].photo).toBe("https://images.unsplash.com/p2");
    expect(suggestions[1].photo).toBe("https://images.unsplash.com/p3");
  });

  it("filters by the typed text, ignoring case", async () => {
    expect(await suggestLocations("mus")).toMatchObject([{ city: "Musanze", count: 1 }]);
    expect(await suggestLocations("rubavu")).toEqual([]);
  });

  it("matches districts too and treats wildcards literally", async () => {
    expect(await suggestLocations("gasabo")).toMatchObject([{ city: "Kigali", count: 2 }]);
    expect(await suggestLocations("%")).toEqual([]);
  });
});

describe("type and price filters", () => {
  async function priced(price: number, overrides: Partial<Prisma.ListingUncheckedCreateInput> = {}, units: ("NIGHT" | "MONTH")[] = ["NIGHT"]) {
    const created = await listing(overrides, units);
    await db.listing.update({ where: { id: created.id }, data: { rates: { updateMany: { where: {}, data: { price } } } } });
    return created;
  }

  it("only returns the chosen types of place", async () => {
    const lodge = await listing({ type: "LODGE" });
    const room = await listing({ type: "ROOM" });
    await listing({ type: "APARTMENT" });
    const ids = (await searchListings({ mode: "short", types: ["LODGE", "ROOM"] })).map((r) => r.id);
    expect(ids.sort()).toEqual([lodge.id, room.id].sort());
  });

  it("keeps places with a rate for the mode inside the price range", async () => {
    await priced(10000);
    const mid = await priced(50000);
    await priced(200000);
    expect((await searchListings({ mode: "short", minPrice: 20000, maxPrice: 100000 })).map((r) => r.id)).toEqual([mid.id]);
    const monthly = await priced(400000, {}, ["MONTH"]);
    expect((await searchListings({ mode: "long", maxPrice: 500000 })).map((r) => r.id)).toEqual([monthly.id]);
  });

  it("gives cards the map position and room counts", async () => {
    await listing({ lat: -1.5, lng: 29.6, bedrooms: 3, bathrooms: 2 });
    const [card] = await searchListings({ mode: "short" });
    expect(card).toMatchObject({ lat: -1.5, lng: 29.6, bedrooms: 3, bathrooms: 2 });
  });
});

describe("map area filter", () => {
  it("only returns places inside the box", async () => {
    const inside = await listing({ lat: -1.95, lng: 30.06 });
    await listing({ lat: -1.5, lng: 29.6 });
    const ids = (await searchListings({ mode: "short", bbox: [-2.0, 30.0, -1.9, 30.1] })).map((r) => r.id);
    expect(ids).toEqual([inside.id]);
  });
});

describe("nearbyListings", () => {
  it("returns other published places around this one, closest first", async () => {
    const here = await listing({ lat: -1.95, lng: 30.06 });
    const far = await listing({ lat: -1.5, lng: 29.6 });
    const near = await listing({ lat: -1.951, lng: 30.061 });
    const mid = await listing({ lat: -1.99, lng: 30.1 });
    await listing({ lat: -1.952, lng: 30.062, status: "DRAFT" });
    const ids = (await nearbyListings(here, 2)).map((r) => r.id);
    expect(ids).toEqual([near.id, mid.id]);
    expect(ids).not.toContain(far.id);
  });
});

describe("bedroom, amenity and availability filters", () => {
  it("keeps places with enough bedrooms and every chosen amenity", async () => {
    const big = await listing({ bedrooms: 3, facilities: ["WIFI", "POOL", "PARKING"] });
    await listing({ bedrooms: 1, facilities: ["WIFI", "POOL"] });
    await listing({ bedrooms: 3, facilities: ["WIFI"] });
    const results = await searchListings({ mode: "short", bedrooms: 2, amenities: ["WIFI", "POOL"] });
    expect(results.map((r) => r.id)).toEqual([big.id]);
  });

  it("hides places booked on the chosen nights or that don't take that stay length", async () => {
    await db.user.create({ data: { id: "guest", name: "Guest", email: "guest@example.com" } });
    const free = await listing();
    const booked = await listing();
    const longOnly = await listing();
    await db.rateOption.updateMany({ where: { listingId: longOnly.id }, data: { minUnits: 7 } });
    const now = new Date("2026-10-14T08:00:00Z");
    const stay = (listingId: string, status: "CONFIRMED" | "PENDING_PAYMENT" | "EXPIRED", holdExpiresAt: Date | null = null) =>
      db.booking.create({
        data: {
          reference: `SR-${listingId.slice(-6).toUpperCase().replace(/[^A-Z2-9]/g, "Z").padEnd(6, "Z")}`,
          listingId,
          guestId: "guest",
          status,
          checkIn: new Date("2026-10-20T00:00:00Z"),
          checkOut: new Date("2026-10-23T00:00:00Z"),
          nights: 3,
          guests: 1,
          nightlyPrice: 45000,
          total: 135000,
          policySnapshot: {},
          holdExpiresAt,
        },
      });
    await stay(booked.id, "CONFIRMED");
    const query = { mode: "short" as const, checkIn: "2026-10-21", checkOut: "2026-10-24" };
    expect((await searchListings(query, 50, now)).map((r) => r.id)).toEqual([free.id]);
    // A checkout day is free for the next guest; without dates everything shows.
    expect((await searchListings({ ...query, checkIn: "2026-10-23", checkOut: "2026-10-25" }, 50, now)).map((r) => r.id).sort()).toEqual(
      [free.id, booked.id].sort(),
    );
    expect(await searchListings({ mode: "short" }, 50, now)).toHaveLength(3);
  });
});

describe("room-by-room availability", () => {
  it("keeps a room-by-room place in date results while one of its rooms is free", async () => {
    await db.user.create({ data: { id: "guest", name: "Guest", email: "guest@example.com" } });
    const lodge = await listing({ bookingModel: "ROOM_BY_ROOM" });
    const [a, b] = await Promise.all(
      ["A", "B"].map((name, position) => db.room.create({ data: { listingId: lodge.id, name, maxGuests: 2, nightlyPrice: 30000, position } })),
    );
    const now = new Date("2026-10-14T08:00:00Z");
    const book = (roomId: string, reference: string) =>
      db.booking.create({
        data: {
          reference,
          listingId: lodge.id,
          roomId,
          guestId: "guest",
          status: "CONFIRMED",
          checkIn: new Date("2026-10-20T00:00:00Z"),
          checkOut: new Date("2026-10-22T00:00:00Z"),
          nights: 2,
          guests: 1,
          nightlyPrice: 30000,
          total: 60000,
          policySnapshot: {},
        },
      });
    const query = { mode: "short" as const, checkIn: "2026-10-20", checkOut: "2026-10-21", location: "kigali" };
    await book(a!.id, "SR-AAAAAA");
    expect((await searchListings(query, 50, now)).map((r) => r.id)).toEqual([lodge.id]);
    await book(b!.id, "SR-BBBBBB");
    expect(await searchListings(query, 50, now)).toEqual([]);
  });
});

describe("getPublishedListingByParam", () => {
  it("finds a listing from its permanent link, even when the ID has dashes", async () => {
    const dashed = await listing({ id: "seed-lake-house" } as Prisma.ListingUncheckedCreateInput);
    const plain = await listing();
    const { getPublishedListingByParam } = await import("./service");
    const { listingIdCandidates } = await import("./links");
    expect((await getPublishedListingByParam(listingIdCandidates("seed-lake-house")))?.id).toBe(dashed.id);
    expect((await getPublishedListingByParam(listingIdCandidates("seed-lake-house-flat-9")))?.id).toBe(dashed.id);
    expect((await getPublishedListingByParam(listingIdCandidates(`${plain.id}-some-old-title`)))?.id).toBe(plain.id);
    expect(await getPublishedListingByParam(listingIdCandidates("nope-nothing"))).toBeNull();
  });
});
