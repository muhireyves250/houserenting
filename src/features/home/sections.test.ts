import { describe, expect, it } from "vitest";
import { buildHomeSections, isGuestFavorite } from "./sections";

type L = Parameters<typeof buildHomeSections>[0][number];
const home = (id: string, city: string, units: ("NIGHT" | "MONTH" | "DAY")[] = ["NIGHT"], extra: Partial<L> = {}): L =>
  ({
    id,
    city,
    title: id,
    type: "APARTMENT",
    district: city,
    maxGuests: 2,
    discountPercent: null,
    ratingAvg: 0,
    ratingCount: 0,
    publishedAt: new Date(),
    photos: [],
    rates: units.map((unit) => ({ unit, price: 1000 })),
    ...extra,
  }) as L;

describe("buildHomeSections", () => {
  it("groups homes into the themed rows, skipping empty ones", () => {
    const sections = buildHomeSections([
      home("k1", "Kigali"),
      home("k2", "Kigali", ["MONTH"]),
      home("m1", "Musanze"),
      home("r1", "Rubavu"),
      home("c1", "Karongi"),
    ]);
    expect(sections.map((s) => [s.key, s.listings.map((l) => l.id)])).toEqual([
      ["kigali", ["k1", "k2"]],
      ["volcanoes", ["m1"]],
      ["kivu", ["r1", "c1"]],
      ["long", ["k2"]],
    ]);
  });

  it("links each row to the matching search and prices long stays per month", () => {
    const [kigali, long] = buildHomeSections([home("k", "Kigali", ["NIGHT", "MONTH"])]).filter((s) => ["kigali", "long"].includes(s.key));
    expect(kigali.query).toEqual({ mode: "short", location: "Kigali" });
    expect(kigali.mode).toBe("short");
    expect(long.query).toEqual({ mode: "long" });
    expect(long.mode).toBe("long");
  });

  it("omits rows with no homes", () => {
    expect(buildHomeSections([home("h", "Huye")]).map((s) => s.key)).toEqual([]);
  });

  it("caps each row", () => {
    const many = Array.from({ length: 15 }, (_, i) => home(`k${i}`, "Kigali"));
    expect(buildHomeSections(many)[0].listings).toHaveLength(10);
  });
});

describe("isGuestFavorite", () => {
  it("needs a high rating from enough reviews", () => {
    expect(isGuestFavorite({ ratingAvg: 4.8, ratingCount: 20 })).toBe(true);
    expect(isGuestFavorite({ ratingAvg: 4.9, ratingCount: 5 })).toBe(false);
    expect(isGuestFavorite({ ratingAvg: 4.5, ratingCount: 200 })).toBe(false);
  });
});
