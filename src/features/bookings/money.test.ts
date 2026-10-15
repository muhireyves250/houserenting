import { describe, expect, it } from "vitest";
import { priceBreakdown } from "./money";

describe("priceBreakdown", () => {
  it("with nothing configured, the guest pays the stay and the owner gets all of it", () => {
    expect(priceBreakdown(135000, { commissionBps: null, guestFeeBps: null })).toEqual({
      subtotal: 135000,
      discount: 0,
      guestFee: 0,
      total: 135000,
      commission: 0,
      hostPayout: 135000,
    });
  });

  it("adds the guest fee on top and takes commission out of the stay price, in whole francs", () => {
    // 5% guest fee, 12.5% commission.
    expect(priceBreakdown(135001, { commissionBps: 1250, guestFeeBps: 500 })).toEqual({
      subtotal: 135001,
      discount: 0,
      guestFee: 6750,
      total: 141751,
      commission: 16875,
      hostPayout: 118126,
    });
  });

  it("always adds up: guest total = owner payout + platform share", () => {
    for (const subtotal of [100, 999, 45000, 1234567]) {
      const b = priceBreakdown(subtotal, { commissionBps: 1000, guestFeeBps: 300 });
      expect(b.total).toBe(b.hostPayout + b.commission + b.guestFee);
    }
  });

  it("a discount the platform funds leaves the owner's payout untouched", () => {
    const b = priceBreakdown(100000, { commissionBps: 1000, guestFeeBps: 500 }, { amount: 10000, fundedBy: "PLATFORM" });
    expect(b).toEqual({ subtotal: 100000, discount: 10000, guestFee: 4500, total: 94500, commission: 10000, hostPayout: 90000 });
  });

  it("a discount the owner funds comes out of the owner's payout", () => {
    const b = priceBreakdown(100000, { commissionBps: 1000, guestFeeBps: null }, { amount: 10000, fundedBy: "HOST" });
    expect(b).toEqual({ subtotal: 100000, discount: 10000, guestFee: 0, total: 90000, commission: 9000, hostPayout: 81000 });
  });

  it("never discounts below zero", () => {
    expect(priceBreakdown(5000, { commissionBps: null, guestFeeBps: null }, { amount: 9000, fundedBy: "PLATFORM" })).toMatchObject({ discount: 5000, total: 0 });
  });
});
