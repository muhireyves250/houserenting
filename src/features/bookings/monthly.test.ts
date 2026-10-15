import { describe, expect, it } from "vitest";
import { addMonthsISO, monthlyQuote } from "./monthly";

describe("monthly rentals", () => {
  it("move out the same day of the month, clamped to short months", () => {
    expect(addMonthsISO("2026-11-01", 6)).toBe("2027-05-01");
    expect(addMonthsISO("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonthsISO("2027-12-15", 12)).toBe("2028-12-15");
  });

  it("charge whole months and a deposit only when one is set", () => {
    expect(monthlyQuote("2026-11-01", 6, 500000, null)).toEqual({ months: 6, monthly: 500000, rent: 3000000, deposit: 0, moveOut: "2027-05-01" });
    expect(monthlyQuote("2026-11-01", 6, 500000, 200).deposit).toBe(1000000);
  });
});
