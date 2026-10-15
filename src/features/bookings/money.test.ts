import { describe, expect, it } from "vitest";
import { priceBreakdown } from "./money";

describe("priceBreakdown", () => {
  it("with nothing configured, the guest pays the stay and the owner gets all of it", () => {
    expect(priceBreakdown(135000, { commissionBps: null, guestFeeBps: null })).toEqual({
      subtotal: 135000,
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
});
