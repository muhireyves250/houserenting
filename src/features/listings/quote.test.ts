import { describe, expect, it } from "vitest";
import { nightsBetween, stayQuote } from "./quote";

describe("nightsBetween", () => {
  it("counts nights between check-in and checkout", () => {
    expect(nightsBetween({ checkIn: "2026-10-13", checkOut: "2026-10-18" })).toBe(5);
    expect(nightsBetween({ checkIn: "2026-10-31", checkOut: "2026-11-02" })).toBe(2);
  });
  it("is 0 without both dates", () => {
    expect(nightsBetween({ checkIn: "2026-10-13" })).toBe(0);
    expect(nightsBetween({})).toBe(0);
  });
});

describe("stayQuote", () => {
  const rates = [
    { unit: "HOUR" as const, price: 9000 },
    { unit: "NIGHT" as const, price: 45000 },
  ];

  it("prices the chosen nights at the nightly rate, after discount", () => {
    expect(stayQuote(rates, 50, { checkIn: "2026-10-13", checkOut: "2026-10-15" })).toEqual({
      nights: 2,
      nightly: 22500,
      total: 45000,
      originalTotal: 90000,
    });
  });

  it("has no original total without a discount", () => {
    expect(stayQuote(rates, null, { checkIn: "2026-10-13", checkOut: "2026-10-14" })).toEqual({
      nights: 1,
      nightly: 45000,
      total: 45000,
      originalTotal: null,
    });
  });

  it("is null without dates or a nightly rate", () => {
    expect(stayQuote(rates, null, { checkIn: "2026-10-13" })).toBeNull();
    expect(stayQuote([{ unit: "MONTH", price: 900000 }], null, { checkIn: "2026-10-13", checkOut: "2026-10-14" })).toBeNull();
  });
});
