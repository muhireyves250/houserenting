import { describe, expect, it } from "vitest";
import { normalizeCode, promoDiscount } from "./discount";

describe("promo codes", () => {
  it("take a percent or a fixed amount off, never below zero", () => {
    expect(promoDiscount(100000, { percentOff: 10, amountOff: null, minSubtotal: null })).toBe(10000);
    expect(promoDiscount(100000, { percentOff: null, amountOff: 15000, minSubtotal: null })).toBe(15000);
    expect(promoDiscount(10000, { percentOff: null, amountOff: 15000, minSubtotal: null })).toBe(10000);
  });

  it("apply only above the minimum spend", () => {
    expect(promoDiscount(40000, { percentOff: 10, amountOff: null, minSubtotal: 50000 })).toBe(0);
  });

  it("ignore case and spaces", () => {
    expect(normalizeCode(" welcome 10 ")).toBe("WELCOME10");
  });
});
