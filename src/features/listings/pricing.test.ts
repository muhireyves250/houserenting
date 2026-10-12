import { describe, expect, it } from "vitest";
import { discountedPrice, headlineRate, isNewListing, rentalModes } from "./pricing";

const rates = [
  { unit: "HOUR" as const, price: 8000 },
  { unit: "DAY" as const, price: 30000 },
  { unit: "NIGHT" as const, price: 45000 },
  { unit: "MONTH" as const, price: 900000 },
];

describe("headlineRate", () => {
  it("prefers nightly, then daily, then hourly for short-term searches", () => {
    expect(headlineRate(rates, "short")?.unit).toBe("NIGHT");
    expect(headlineRate(rates.filter((r) => r.unit !== "NIGHT"), "short")?.unit).toBe("DAY");
    expect(headlineRate([rates[0], rates[3]], "short")?.unit).toBe("HOUR");
  });

  it("uses the monthly rate for long-term searches", () => {
    expect(headlineRate(rates, "long")?.unit).toBe("MONTH");
  });

  it("returns undefined when the listing has no rate for that mode", () => {
    expect(headlineRate([rates[3]], "short")).toBeUndefined();
    expect(headlineRate([rates[2]], "long")).toBeUndefined();
  });
});

describe("discountedPrice", () => {
  it("applies a percentage discount and rounds to whole francs", () => {
    expect(discountedPrice(1800, 50)).toBe(900);
    expect(discountedPrice(45555, 15)).toBe(38722);
  });

  it("ignores missing, zero or out-of-range discounts", () => {
    expect(discountedPrice(1800, null)).toBe(1800);
    expect(discountedPrice(1800, 0)).toBe(1800);
    expect(discountedPrice(1800, 120)).toBe(1800);
  });
});

describe("isNewListing", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  it("is new for 14 days after publishing", () => {
    expect(isNewListing(new Date("2026-10-01T12:00:00Z"), now)).toBe(true);
    expect(isNewListing(new Date("2026-09-20T12:00:00Z"), now)).toBe(false);
    expect(isNewListing(null, now)).toBe(false);
  });
});

describe("rentalModes", () => {
  it("detects short-term (hour/day/night) and long-term (month) availability", () => {
    expect(rentalModes([{ unit: "NIGHT", price: 1 }])).toEqual({ short: true, long: false });
    expect(rentalModes([{ unit: "MONTH", price: 1 }])).toEqual({ short: false, long: true });
    expect(rentalModes([{ unit: "HOUR", price: 1 }, { unit: "MONTH", price: 1 }])).toEqual({ short: true, long: true });
  });
});
