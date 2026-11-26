import { describe, expect, it } from "vitest";
import { normalizeCode, promoDiscount, promoState, promoterMoney } from "./discount";

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

describe("promoState", () => {
  const now = new Date("2026-11-26T10:00:00Z");
  const code = { active: true, startsAt: null, endsAt: null, maxUses: null, usedCount: 0 };
  it("says whether a code is active or ended", () => {
    expect(promoState(code, now)).toBe("active");
    expect(promoState({ ...code, active: false }, now)).toBe("off");
    expect(promoState({ ...code, endsAt: new Date("2026-11-26T09:00:00Z") }, now)).toBe("expired");
    expect(promoState({ ...code, maxUses: 3, usedCount: 3 }, now)).toBe("usedUp");
    expect(promoState({ ...code, startsAt: new Date("2026-12-01T00:00:00Z") }, now)).toBe("scheduled");
  });
});

describe("promoterMoney", () => {
  it("adds up what a promoter made, what waits for approval, what's approved to pay and what's paid", () => {
    const paidAt = new Date();
    expect(
      promoterMoney([
        { amount: 1000, status: "PENDING", paidAt: null },
        { amount: 2000, status: "APPROVED", paidAt: null },
        { amount: 4000, status: "APPROVED", paidAt },
        { amount: 8000, status: "VOID", paidAt: null },
      ]),
    ).toEqual({ made: 7000, toApprove: 1000, toPay: 2000, paid: 4000 });
  });
});
