import { describe, expect, it } from "vitest";
import { validListing } from "./fixtures";
import { fieldErrors, listingInput } from "./validation";

describe("listingInput", () => {
  it("accepts a complete listing and tidies lists", () => {
    const parsed = listingInput.parse(validListing);
    expect(parsed.facilities).toEqual(["WIFI", "KITCHEN"]);
    expect(parsed.characteristics).toEqual(["Balcony"]);
    expect(parsed.rates[0]).toMatchObject({ unit: "NIGHT", dayStartTime: null });
  });

  it("needs at least one price, each way of renting once", () => {
    expect(fieldErrors(listingInput.safeParse({ ...validListing, rates: [] }).error!)).toHaveProperty("rates");
    const twice = { ...validListing, rates: [validListing.rates[0], validListing.rates[0]] };
    expect(fieldErrors(listingInput.safeParse(twice).error!)).toEqual({ rates: "duplicateUnit" });
  });

  it("keeps places inside Rwanda and stays sensible", () => {
    const errors = fieldErrors(
      listingInput.safeParse({
        ...validListing,
        lat: 0.3,
        maxGuests: 0,
        rates: [{ unit: "NIGHT", price: 45000, minUnits: 5, maxUnits: 2, checkInTime: "25:00" }],
      }).error!,
    );
    expect(Object.keys(errors).sort()).toEqual(["lat", "maxGuests", "rates.0.checkInTime", "rates.0.maxUnits"]);
  });
});

describe("ways of booking by type of place", () => {
  it("lets houses offer weeks and years, but lodges only nights or days", () => {
    expect(listingInput.safeParse({ ...validListing, rates: [{ unit: "WEEK", price: 200000 }, { unit: "YEAR", price: 6000000 }] }).success).toBe(true);
    const lodge = { ...validListing, type: "LODGE" as const };
    expect(listingInput.safeParse({ ...lodge, rates: [{ unit: "NIGHT", price: 40000 }, { unit: "DAY", price: 30000 }] }).success).toBe(true);
    expect(fieldErrors(listingInput.safeParse({ ...lodge, rates: [{ unit: "MONTH", price: 400000 }] }).error!)).toEqual({ rates: "lodgeUnits" });
  });
});
