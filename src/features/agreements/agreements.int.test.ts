import { beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/features/bookings/service";
import { addExpense } from "@/features/expenses/service";
import { dailySettlements, moneyOverview, ownerBalances } from "@/features/ledger/service";
import { updateSettings } from "@/features/settings/service";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { agreementAt, agreementHistory, commissionUnder, setAgreement } from "./service";

const admin = { id: "admin", role: "ADMIN" };
const NOW = new Date("2026-10-15T08:00:00Z");
const noPolicy = { en: null, fr: null, rw: null };

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "host", name: "Host", email: "host@example.com" },
      { id: "g1", name: "Guest", email: "g1@example.com" },
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" },
    ],
  });
  await updateSettings("admin", { commissionPercent: 10, guestFeePercent: null, holdMinutes: null, monthlyDepositPercent: null, cancellationPolicy: noPolicy });
  await db.listing.create({
    data: { id: "flat", hostId: "host", title: "City flat", description: "Nice", type: "APARTMENT", status: "PUBLISHED", addressLine: "KG 1", district: "Gasabo", city: "Kigali", lat: -1.95, lng: 30.06, sizeM2: 60, rooms: 3, bedrooms: 2, bathrooms: 1, maxGuests: 4, rates: { create: [{ unit: "NIGHT", price: 50000 }] } },
  });
});

describe("commission agreements", () => {
  it("each place has its own agreement with dates and history; bookings use the one in force when made", async () => {
    expect(await setAgreement({ id: "host" }, "PLACE", "flat", { percent: 5 })).toEqual({ ok: false, error: "notAllowed" });
    expect(await setAgreement(admin, "PLACE", "flat", { percent: 60 })).toEqual({ ok: false, error: "invalid" });
    expect(await setAgreement(admin, "PLACE", "flat", { percent: 5, fixedFee: 100 })).toEqual({ ok: false, error: "invalid" });
    expect(await setAgreement(admin, "PLACE", "flat", { percent: 8, effectiveFrom: "2026-10-01" }, NOW)).toEqual({ ok: true });
    // A new agreement from next month: today's stays the 8%.
    expect(await setAgreement(admin, "PLACE", "flat", { fixedFee: 7000, effectiveFrom: "2026-11-01", note: "new contract" }, NOW)).toEqual({ ok: true });
    expect(await agreementAt("PLACE", "flat", NOW)).toEqual({ percentBps: 800, fixedFee: null });
    expect(await agreementAt("PLACE", "flat", new Date("2026-11-02T00:00:00Z"))).toEqual({ percentBps: null, fixedFee: 7000 });
    expect((await agreementHistory("PLACE", "flat")).map((a) => [a.percentBps, a.fixedFee, a.by])).toEqual([[null, 7000, "Admin"], [800, null, "Admin"]]);

    const pay = { method: "mtn" as const, phone: "0788123456" };
    const now = await createBooking({ guestId: "g1", listingId: "flat", checkIn: "2026-11-05", checkOut: "2026-11-07", guests: 1, payment: pay }, NOW);
    if (!now.ok) throw new Error(now.error);
    expect(await db.booking.findUniqueOrThrow({ where: { reference: now.reference } })).toMatchObject({ subtotal: 100_000, commission: 8_000, hostPayout: 92_000 });
    const later = await createBooking({ guestId: "g1", listingId: "flat", checkIn: "2026-11-10", checkOut: "2026-11-12", guests: 1, payment: pay }, new Date("2026-11-02T08:00:00Z"));
    if (!later.ok) throw new Error(later.error);
    expect(await db.booking.findUniqueOrThrow({ where: { reference: later.reference } })).toMatchObject({ commission: 7_000, hostPayout: 93_000 });
    expect(commissionUnder({ percentBps: null, fixedFee: 7000 }, 5000)).toBe(5000);
    expect(commissionUnder(null, 5000)).toBeNull();
  });
});

describe("money overview, daily settlements and expenses", () => {
  it("food and laundry are due at once (settled daily); revenue is commission and fees only; expenses lower net earnings", async () => {
    await db.ledgerEntry.createMany({
      data: [
        { kind: "GUEST_PAYMENT", amount: 6000, note: "food OR-AAAAAA" },
        { kind: "COMMISSION", amount: 600, note: "food OR-AAAAAA" },
        { kind: "HOST_PAYABLE", amount: 5400, hostId: "host", note: "food OR-AAAAAA" },
        { kind: "GUEST_PAYMENT", amount: 2000, note: "laundry LD-AAAAAA" },
        { kind: "COMMISSION", amount: 200, note: "laundry LD-AAAAAA" },
        { kind: "HOST_PAYABLE", amount: 1800, hostId: "host", note: "laundry LD-AAAAAA" },
      ],
    });
    const [host] = await ownerBalances();
    expect(host).toMatchObject({ hostId: "host", due: 7200, upcoming: 0 });
    const daily = await dailySettlements();
    expect(daily).toEqual([expect.objectContaining({ hostId: "host", name: "Host", food: 5400, laundry: 1800 })]);
    expect(await addExpense({ id: "host" }, { spentOn: "2026-11-20", category: "RENT", description: "Office", amount: 300 })).toBe(false);
    expect(await addExpense(admin, { spentOn: "2026-11-20", category: "RENT", description: "Office", amount: 300 })).toBe(true);
    expect(await moneyOverview()).toMatchObject({ received: 8000, revenue: 800, dueNow: 7200, expenses: 300, net: 500 });
  });
});
