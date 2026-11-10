import { describe, expect, it } from "vitest";
import { gramsFromKg, laundryOwed, laundryPrice, laundrySplit } from "./rules";

describe("laundry rules", () => {
  it("reads the weight staff type in kilograms", () => {
    expect(gramsFromKg("2.5")).toBe(2500);
    expect(gramsFromKg("3,25")).toBe(3250);
    expect(gramsFromKg("0")).toBeNull();
    expect(gramsFromKg("abc")).toBeNull();
    expect(gramsFromKg("80")).toBeNull();
  });

  it("prices by weight, and free laundry costs nothing", () => {
    expect(laundryPrice(2500, 1500)).toBe(3750);
    expect(laundryPrice(2500, 0)).toBe(0);
  });

  it("splits a payment into the platform's commission and the place's share", () => {
    expect(laundrySplit(3750, 1000)).toEqual({ commission: 375, placeShare: 3375 });
    expect(laundrySplit(3750, null)).toEqual({ commission: 0, placeShare: 3750 });
  });

  it("only priced, unpaid, live orders are owed", () => {
    expect(laundryOwed({ amount: 3750, paidAt: null, status: "RETURNED" })).toBe(true);
    expect(laundryOwed({ amount: 0, paidAt: null, status: "RETURNED" })).toBe(false);
    expect(laundryOwed({ amount: 3750, paidAt: new Date(), status: "RETURNED" })).toBe(false);
    expect(laundryOwed({ amount: 3750, paidAt: null, status: "CANCELLED" })).toBe(false);
  });
});
