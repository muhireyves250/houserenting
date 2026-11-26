import { describe, expect, it } from "vitest";
import { againParam, againStart, parseAgain, soonestFree } from "./again";

describe("book again", () => {
  it("carries the guests, way of booking and length in the link", () => {
    expect(againParam({ guests: 2, unit: "NIGHT", nights: 3, quantity: 1 })).toBe("2.NIGHT.3");
    expect(againParam({ guests: 1, unit: "MONTH", nights: 30, quantity: 2 })).toBe("1.MONTH.2");
    expect(parseAgain("2.NIGHT.3")).toEqual({ guests: 2, unit: "NIGHT", length: 3 });
    expect(parseAgain("2.SECOND.3")).toBeNull();
    expect(parseAgain("0.NIGHT.3")).toBeNull();
    expect(parseAgain(undefined)).toBeNull();
  });

  it("picks the soonest free nights of the same length, for that room and whole-place bookings", () => {
    const booked = [
      { checkIn: "2026-12-01", checkOut: "2026-12-03", roomId: "r1" },
      { checkIn: "2026-12-04", checkOut: "2026-12-05", roomId: null },
      { checkIn: "2026-12-01", checkOut: "2026-12-20", roomId: "r2" },
    ];
    expect(soonestFree(booked, "r1", 2, "2026-12-01")).toEqual({ checkIn: "2026-12-05", checkOut: "2026-12-07" });
    expect(soonestFree(booked, "r1", 1, "2026-12-01")).toEqual({ checkIn: "2026-12-03", checkOut: "2026-12-04" });
    expect(againStart({ guests: 3, unit: "NIGHT", length: 1 }, booked, "r1", "2026-12-01")).toMatchObject({ guests: 3, range: { checkIn: "2026-12-03" } });
    expect(againStart({ guests: 1, unit: "MONTH", length: 2 }, booked, "r1", "2026-12-01")?.plan).toEqual({ start: "2026-12-03", quantity: 2, startTime: "" });
  });
});
