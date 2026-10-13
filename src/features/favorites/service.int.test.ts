import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { listFavorites, savedListingIds, toggleFavorite } from "./service";

async function listing(id: string, status: "PUBLISHED" | "DRAFT" = "PUBLISHED") {
  return db.listing.create({
    data: {
      id,
      hostId: "host",
      title: `Home ${id}`,
      description: "Nice",
      type: "APARTMENT",
      status,
      publishedAt: new Date(),
      addressLine: "KG 1",
      district: "Gasabo",
      city: "Kigali",
      lat: -1.95,
      lng: 30.06,
      sizeM2: 50,
      rooms: 2,
      bedrooms: 1,
      bathrooms: 1,
      maxGuests: 2,
      photos: { create: [{ url: `https://images.unsplash.com/${id}`, publicId: id, width: 1, height: 1, position: 0 }] },
      rates: { create: [{ unit: "NIGHT", price: 50000 }] },
    },
  });
}

beforeEach(async () => {
  await resetDb();
  await db.user.create({ data: { id: "host", name: "Host", email: "host@example.com" } });
  await db.user.create({ data: { id: "u1", name: "Guest", email: "guest@example.com" } });
  await db.user.create({ data: { id: "u2", name: "Other", email: "other@example.com" } });
  await listing("a");
  await listing("b");
});

describe("favorites", () => {
  it("toggles a listing on and off for one user", async () => {
    expect(await toggleFavorite("u1", "a")).toBe(true);
    expect(await savedListingIds("u1", ["a", "b"])).toEqual(new Set(["a"]));
    expect(await toggleFavorite("u1", "a")).toBe(false);
    expect(await savedListingIds("u1", ["a", "b"])).toEqual(new Set());
  });

  it("keeps each user's saves separate", async () => {
    await toggleFavorite("u1", "a");
    expect(await savedListingIds("u2", ["a"])).toEqual(new Set());
  });

  it("refuses unknown or unpublished listings", async () => {
    await listing("draft", "DRAFT");
    await expect(toggleFavorite("u1", "draft")).rejects.toThrow(/not found/i);
    await expect(toggleFavorite("u1", "nope")).rejects.toThrow(/not found/i);
  });

  it("lists saved homes as cards, most recently saved first, hiding ones that were unpublished", async () => {
    await toggleFavorite("u1", "a");
    await new Promise((r) => setTimeout(r, 20));
    await toggleFavorite("u1", "b");
    expect((await listFavorites("u1")).map((l) => l.id)).toEqual(["b", "a"]);
    await db.listing.update({ where: { id: "a" }, data: { status: "ARCHIVED" } });
    expect((await listFavorites("u1")).map((l) => l.id)).toEqual(["b"]);
  });
});
