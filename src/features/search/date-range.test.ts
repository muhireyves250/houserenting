import { describe, expect, it } from "vitest";
import { addMonths, inRange, isDayBlocked, monthGrid, pickDate, rangeOverlaps, todayISO } from "./date-range";

describe("monthGrid", () => {
  it("lays out October 2026 in Sunday-first weeks", () => {
    const weeks = monthGrid(2026, 9);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(weeks[4]).toEqual(["2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"]);
  });

  it("handles leap February", () => {
    expect(monthGrid(2028, 1).flat().filter(Boolean).at(-1)).toBe("2028-02-29");
  });
});

describe("addMonths", () => {
  it("wraps across years in both directions", () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("pickDate", () => {
  it("picks check-in, then a later check-out", () => {
    const a = pickDate({}, "2026-10-14");
    expect(a).toEqual({ checkIn: "2026-10-14" });
    expect(pickDate(a, "2026-10-18")).toEqual({ checkIn: "2026-10-14", checkOut: "2026-10-18" });
  });

  it("restarts when the second click is on or before check-in", () => {
    expect(pickDate({ checkIn: "2026-10-14" }, "2026-10-10")).toEqual({ checkIn: "2026-10-10" });
    expect(pickDate({ checkIn: "2026-10-14" }, "2026-10-14")).toEqual({ checkIn: "2026-10-14" });
  });

  it("starts a new range when both dates are already set", () => {
    expect(pickDate({ checkIn: "2026-10-14", checkOut: "2026-10-18" }, "2026-11-02")).toEqual({ checkIn: "2026-11-02" });
  });
});

describe("inRange", () => {
  it("is true strictly between check-in and check-out", () => {
    const range = { checkIn: "2026-10-14", checkOut: "2026-10-18" };
    expect(inRange(range, "2026-10-15")).toBe(true);
    expect(inRange(range, "2026-10-14")).toBe(false);
    expect(inRange(range, "2026-10-18")).toBe(false);
    expect(inRange({ checkIn: "2026-10-14" }, "2026-10-15")).toBe(false);
  });
});

describe("todayISO", () => {
  it("uses Kigali time, not UTC", () => {
    expect(todayISO(new Date("2026-10-11T23:30:00Z"))).toBe("2026-10-12");
  });
});

describe("isDayBlocked", () => {
  const booked = [{ checkIn: "2026-10-20", checkOut: "2026-10-23" }];

  it("blocks booked nights for check-in, but the checkout day is free", () => {
    expect(isDayBlocked({}, "2026-10-19", booked)).toBe(false);
    expect(isDayBlocked({}, "2026-10-20", booked)).toBe(true);
    expect(isDayBlocked({}, "2026-10-22", booked)).toBe(true);
    expect(isDayBlocked({}, "2026-10-23", booked)).toBe(false);
  });

  it("while choosing checkout, blocks days past the next booking", () => {
    const picking = { checkIn: "2026-10-17" };
    expect(isDayBlocked(picking, "2026-10-19", booked)).toBe(false);
    expect(isDayBlocked(picking, "2026-10-20", booked)).toBe(false);
    expect(isDayBlocked(picking, "2026-10-21", booked)).toBe(true);
    expect(isDayBlocked(picking, "2026-10-25", booked)).toBe(true);
    // Earlier days start a new check-in instead.
    expect(isDayBlocked(picking, "2026-10-15", booked)).toBe(false);
  });

  it("rangeOverlaps tells whether a chosen stay collides with a booking", () => {
    expect(rangeOverlaps({ checkIn: "2026-10-18", checkOut: "2026-10-20" }, booked)).toBe(false);
    expect(rangeOverlaps({ checkIn: "2026-10-22", checkOut: "2026-10-24" }, booked)).toBe(true);
    expect(rangeOverlaps({ checkIn: "2026-10-23", checkOut: "2026-10-24" }, booked)).toBe(false);
  });
});
