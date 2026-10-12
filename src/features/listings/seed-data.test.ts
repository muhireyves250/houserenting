import { describe, expect, it } from "vitest";
import { SEED_LISTINGS } from "./seed-data";

describe("SEED_LISTINGS", () => {
  it("has a dozen listings with unique ids", () => {
    expect(SEED_LISTINGS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(SEED_LISTINGS.map((l) => l.id)).size).toBe(SEED_LISTINGS.length);
  });

  it("covers several Rwandan cities and both rental modes", () => {
    expect(new Set(SEED_LISTINGS.map((l) => l.city)).size).toBeGreaterThanOrEqual(5);
    const units = SEED_LISTINGS.flatMap((l) => l.rates.map((r) => r.unit));
    expect(new Set(units)).toEqual(new Set(["HOUR", "DAY", "NIGHT", "MONTH"]));
  });

  it.each(SEED_LISTINGS.map((l) => [l.id, l] as const))("%s is valid", (_id, l) => {
    expect(l.photos.length).toBeGreaterThanOrEqual(3);
    for (const url of l.photos) expect(url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
    expect(l.rates.length).toBeGreaterThanOrEqual(1);
    expect(new Set(l.rates.map((r) => r.unit)).size).toBe(l.rates.length);
    for (const r of l.rates) expect(Number.isSafeInteger(r.price) && r.price > 0).toBe(true);
    // Rwanda bounding box
    expect(l.lat).toBeGreaterThan(-2.9);
    expect(l.lat).toBeLessThan(-1.0);
    expect(l.lng).toBeGreaterThan(28.8);
    expect(l.lng).toBeLessThan(30.95);
  });
});
