import { describe, expect, it } from "vitest";
import { aggregate, periodKey, type ReportBooking } from "./aggregate";

const b = (over: Partial<ReportBooking>): ReportBooking => ({
  reference: "SR-1",
  checkIn: "2026-10-05",
  nights: 2,
  total: 110_000,
  guestFee: 10_000,
  commission: 10_000,
  hostPayout: 90_000,
  discount: 0,
  deposit: 0,
  refunded: 0,
  placeId: "a",
  place: "Lake house",
  type: "PRIVATE_HOUSE",
  ownerId: "o1",
  owner: "Owner",
  ...over,
});

describe("periodKey", () => {
  it("groups days into weeks starting Monday, months and years", () => {
    expect(periodKey("2026-10-08", "week")).toBe("2026-10-05");
    expect(periodKey("2026-10-05", "week")).toBe("2026-10-05");
    expect(periodKey("2026-10-04", "week")).toBe("2026-09-28");
    expect(periodKey("2026-10-08", "month")).toBe("2026-10");
    expect(periodKey("2026-10-08", "year")).toBe("2026");
  });
});

describe("aggregate", () => {
  it("adds up money, keeps deposits out of revenue, and estimates taxes on the platform's net share", () => {
    const report = aggregate([b({}), b({ reference: "SR-2", checkIn: "2026-10-06", placeId: "b", place: "Studio", type: "APARTMENT", deposit: 50_000, total: 160_000, refunded: 10_000 })], {
      by: "month",
      from: "2026-10-01",
      to: "2026-10-31",
      vatBps: 1800,
      citBps: null,
    });
    expect(report.totals).toMatchObject({ bookings: 2, nights: 4, gross: 220_000, platform: 40_000, refunds: 10_000 });
    expect(report.byPeriod).toEqual([expect.objectContaining({ key: "2026-10", bookings: 2 })]);
    expect(report.byType.map((r) => r.key)).toEqual(["PRIVATE_HOUSE", "APARTMENT"]);
    expect(report.tax).toEqual({ base: 30_000, vat: 5_400, cit: null });
    expect(report.busiest[0]).toEqual({ day: "2026-10-05", count: 1 });
    expect(report.quietest[0]?.count).toBe(0);
    expect(report.weekdays[1]).toMatchObject({ bookings: 1 });
  });
});
