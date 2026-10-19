import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { buildReport, readFilter, reportCsv } from "./service";

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({ data: [{ id: "host", name: "Host", email: "host@example.com" }, { id: "guest", name: "Guest", email: "guest@example.com" }] });
  await db.listing.create({
    data: { id: "house", hostId: "host", title: "House", description: "Nice", type: "LODGE", status: "PUBLISHED", addressLine: "KG 1", district: "Musanze", city: "Musanze", lat: -1.5, lng: 29.6, sizeM2: 90, rooms: 3, bedrooms: 2, bathrooms: 1, maxGuests: 4 },
  });
  await db.platformConfig.create({ data: { id: 1, vatBps: 1800 } });
  const base = { listingId: "house", guestId: "guest", nights: 2, guests: 1, nightlyPrice: 50_000, subtotal: 100_000, total: 105_000, guestFee: 5_000, commission: 10_000, hostPayout: 90_000, policySnapshot: {} };
  await db.booking.create({ data: { ...base, reference: "SR-RPT001", status: "COMPLETED", checkIn: new Date("2026-10-05T00:00:00Z"), checkOut: new Date("2026-10-07T00:00:00Z"), startAt: new Date("2026-10-05T12:00:00Z"), endAt: new Date("2026-10-07T09:00:00Z") } });
  await db.booking.create({ data: { ...base, reference: "SR-RPT002", status: "EXPIRED", checkIn: new Date("2026-10-08T00:00:00Z"), checkOut: new Date("2026-10-10T00:00:00Z"), startAt: new Date("2026-10-08T12:00:00Z"), endAt: new Date("2026-10-10T09:00:00Z") } });
});

describe("reports", () => {
  it("counts paid business by stay date and exports the same totals", async () => {
    const f = readFilter({ from: "2026-10-01", to: "2026-10-31", by: "week", type: "LODGE" });
    const { report } = await buildReport(f);
    expect(report.totals).toMatchObject({ bookings: 1, gross: 105_000, platform: 15_000, hostPayout: 90_000 });
    expect(report.tax.vat).toBe(2_700);
    expect(report.byPeriod.map((p) => p.key)).toEqual(["2026-10-05"]);
    const csv = await reportCsv(f);
    expect(csv).toContain("SR-RPT001");
    expect(csv).not.toContain("SR-RPT002");
    expect(csv).toContain('"TOTAL"');
  });
});
