import { describe, expect, it } from "vitest";
import { periodFor, unitsAllowedFor, withinHours } from "./period";

describe("periodFor", () => {
  it("nights and days run midnight to midnight in Kigali", () => {
    expect(periodFor("NIGHT", "2026-11-01", 2)).toEqual({
      startAt: new Date("2026-10-31T22:00:00Z"),
      endAt: new Date("2026-11-02T22:00:00Z"),
      checkIn: "2026-11-01",
      checkOut: "2026-11-03",
    });
    expect(periodFor("DAY", "2026-11-01", 3).checkOut).toBe("2026-11-04");
  });

  it("hours start at the chosen time", () => {
    const p = periodFor("HOUR", "2026-11-01", 3, "09:30");
    expect(p.startAt).toEqual(new Date("2026-11-01T07:30:00Z"));
    expect(p.endAt).toEqual(new Date("2026-11-01T10:30:00Z"));
    expect(p.checkIn).toBe("2026-11-01");
  });

  it("weeks, months and years count from the move-in day", () => {
    expect(periodFor("WEEK", "2026-11-01", 2).checkOut).toBe("2026-11-15");
    expect(periodFor("MONTH", "2027-01-31", 1).checkOut).toBe("2027-02-28");
    expect(periodFor("YEAR", "2026-11-01", 1).checkOut).toBe("2027-11-01");
  });
});

describe("units by type of place", () => {
  it("lodges offer nights and days only; other places any unit", () => {
    expect(unitsAllowedFor("LODGE")).toEqual(["NIGHT", "DAY"]);
    expect(unitsAllowedFor("APARTMENT")).toContain("YEAR");
  });
});

describe("withinHours", () => {
  it("keeps hourly bookings inside opening hours and the same day", () => {
    expect(withinHours("09:00", 3, "08:00", "20:00")).toBe(true);
    expect(withinHours("18:00", 3, "08:00", "20:00")).toBe(false);
    expect(withinHours("07:00", 1, "08:00", null)).toBe(false);
    expect(withinHours("23:00", 2, null, null)).toBe(false);
  });
});
