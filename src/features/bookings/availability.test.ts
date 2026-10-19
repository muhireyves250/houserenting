import { describe, expect, it } from "vitest";
import { bookableWindow, dayClosed, daysUntil, insideWindow, onWorkingDays } from "./availability";

describe("bookable window", () => {
  it("is the management agreement narrowed by the place's own dates", () => {
    expect(bookableWindow({ contractStart: "2026-11-01", contractEnd: "2027-10-31", availableFrom: "2026-12-01", availableUntil: null })).toEqual({
      from: "2026-12-01",
      until: "2027-10-31",
    });
    expect(bookableWindow({})).toEqual({ from: undefined, until: undefined });
  });

  it("refuses stays outside the agreement; the last day is the last night", () => {
    const w = { from: "2026-11-01", until: "2026-11-30" };
    expect(insideWindow("2026-10-31", "2026-11-02", w)).toBe(false);
    expect(insideWindow("2026-11-28", "2026-12-01", w)).toBe(true);
    expect(insideWindow("2026-11-28", "2026-12-02", w)).toBe(false);
  });
});

describe("working days", () => {
  // 2026-11-02 is a Monday; working Monday to Friday.
  const weekdays = [1, 2, 3, 4, 5];
  it("stays must start on a working day", () => {
    expect(onWorkingDays("NIGHT", "2026-11-02", "2026-11-09", weekdays)).toBe(true);
    expect(onWorkingDays("NIGHT", "2026-11-01", "2026-11-03", weekdays)).toBe(false);
  });

  it("hourly and daily bookings use every day they cover", () => {
    expect(onWorkingDays("DAY", "2026-11-05", "2026-11-07", weekdays)).toBe(true);
    expect(onWorkingDays("DAY", "2026-11-06", "2026-11-08", weekdays)).toBe(false);
    expect(onWorkingDays("HOUR", "2026-11-02", "2026-11-03", [])).toBe(true);
  });

  it("closes calendar days outside the window or on closed days", () => {
    expect(dayClosed("2026-11-01", { from: "2026-11-02" }, [])).toBe(true);
    expect(dayClosed("2026-11-07", {}, weekdays)).toBe(true);
    expect(dayClosed("2026-11-04", {}, weekdays)).toBe(false);
  });

  it("counts days to a contract's end for renewal reminders", () => {
    expect(daysUntil("2026-11-18", "2026-10-19")).toBe(30);
  });
});
