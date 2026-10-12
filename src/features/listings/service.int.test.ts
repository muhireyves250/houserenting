import { beforeEach, describe, expect, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { featuredListings, getPublishedListing, searchListings, suggestLocations } from "./service";

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
