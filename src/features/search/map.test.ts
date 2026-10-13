import { describe, expect, it } from "vitest";
import { pinLabel, pinPrice, resultsBounds } from "./map";

describe("pinLabel", () => {
  it("shortens prices for map pins", () => {
    expect(pinLabel(45000, "en")).toBe("RWF 45K");
    expect(pinLabel(2500000, "en")).toBe("RWF 2.5M");
    expect(pinLabel(900, "en")).toBe("RWF 900");
  });
});

describe("pinPrice", () => {
  const rates = [
    { unit: "NIGHT" as const, price: 50000 },
    { unit: "MONTH" as const, price: 900000 },
  ];
  it("matches the card: headline rate for the mode, after discount, nights priced for 2", () => {
    expect(pinPrice({ rates, discountPercent: 10 }, "short")).toEqual({ amount: 90000, unit: "NIGHT" });
    expect(pinPrice({ rates, discountPercent: null }, "long")).toEqual({ amount: 900000, unit: "MONTH" });
  });
});

describe("resultsBounds", () => {
  it("returns the south-west and north-east corners around all places", () => {
    expect(
      resultsBounds([
        { lat: -1.95, lng: 30.06 },
        { lat: -1.5, lng: 29.6 },
        { lat: -2.1, lng: 29.3 },
      ]),
    ).toEqual([
      [-2.1, 29.3],
      [-1.5, 30.06],
    ]);
  });

  it("is null with no places", () => {
    expect(resultsBounds([])).toBeNull();
  });
});
