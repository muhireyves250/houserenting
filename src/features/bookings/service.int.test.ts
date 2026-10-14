import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { bookedRanges, cancelPendingBooking, createBooking, getGuestBooking, guestBookings, staffMoveBooking } from "./service";

const NOW = new Date("2026-10-14T08:00:00Z");

async function listing(id: string, extra: { minNights?: number; maxNights?: number; status?: "PUBLISHED" | "DRAFT" } = {}) {
  return db.listing.create({
    data: {
      id,
      hostId: "host",
      title: `Home ${id}`,
      description: "Nice",
      type: "APARTMENT",
      status: extra.status ?? "PUBLISHED",
      publishedAt: new Date(),
      addressLine: "KG 1",
      district: "Gasabo",
      city: "Kigali",
      lat: -1.95,
      lng: 30.06,
      sizeM2: 50,
      rooms: 2,
      bedrooms: 1,
      bathrooms: 1,
      maxGuests: 3,
      discountPercent: 10,
      termsOfRent: ["No parties"],
      rates: {
        create: [
          { unit: "NIGHT", price: 50000, minUnits: extra.minNights ?? 1, maxUnits: extra.maxNights ?? null, checkInTime: "14:00", checkOutTime: "11:00" },
        ],
      },
    },
  });
}

const stay = (over: Partial<Parameters<typeof createBooking>[0]> = {}) => ({
  guestId: "u1",
  listingId: "a",
  checkIn: "2026-10-20",
  checkOut: "2026-10-23",
  guests: 2,
  payment: { method: "mtn" as const, phone: "0781234567" },
  ...over,
});

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "host", name: "Host", email: "host@example.com" },
      { id: "u1", name: "Guest", email: "guest@example.com" },
      { id: "u2", name: "Other", email: "other@example.com" },
    ],
  });
  await listing("a");
});

describe("createBooking", () => {
  it("prices the stay on the server, holds the dates and logs the first status", async () => {
    const result = await createBooking(stay(), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const booking = await db.booking.findUniqueOrThrow({ where: { reference: result.reference }, include: { events: true } });
    expect(booking).toMatchObject({ status: "PENDING_PAYMENT", nights: 3, nightlyPrice: 45000, total: 135000, guests: 2, paymentMethod: "mtn" });
    expect(booking.payerPhone).toBe("078 ••• 4567");
    expect(booking.holdExpiresAt!.getTime()).toBeGreaterThan(NOW.getTime());
    expect(booking.policySnapshot).toMatchObject({ checkInTime: "14:00", checkOutTime: "11:00", houseRules: ["No parties"] });
    expect(booking.events).toEqual([expect.objectContaining({ fromStatus: null, toStatus: "PENDING_PAYMENT", actorId: "u1" })]);
  });

  it("refuses overlapping dates, but a checkout day can be the next check-in", async () => {
    expect((await createBooking(stay(), NOW)).ok).toBe(true);
    expect(await createBooking(stay({ guestId: "u2", checkIn: "2026-10-22", checkOut: "2026-10-25" }), NOW)).toEqual({ ok: false, error: "unavailable" });
    expect((await createBooking(stay({ guestId: "u2", checkIn: "2026-10-23", checkOut: "2026-10-25" }), NOW)).ok).toBe(true);
  });

  it("lets only one of two simultaneous bookings for the same nights through", async () => {
    const results = await Promise.all([createBooking(stay(), NOW), createBooking(stay({ guestId: "u2" }), NOW)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: "unavailable" }]);
    expect(await db.booking.count()).toBe(1);
  });

  it("releases dates whose payment hold ran out", async () => {
    const first = await createBooking(stay(), NOW);
    const later = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const second = await createBooking(stay({ guestId: "u2" }), later);
    expect(second.ok).toBe(true);
    const expired = await db.booking.findUniqueOrThrow({ where: { reference: first.ok ? first.reference : "" }, include: { events: true } });
    expect(expired.status).toBe("EXPIRED");
    expect(expired.events.map((e) => e.toStatus)).toEqual(["PENDING_PAYMENT", "EXPIRED"]);
  });

  it("checks dates, guests, stay length, the listing and the payer number", async () => {
    await listing("b", { minNights: 2, maxNights: 5 });
    await listing("draft", { status: "DRAFT" });
    expect(await createBooking(stay({ checkIn: "2026-10-10", checkOut: "2026-10-12" }), NOW)).toEqual({ ok: false, error: "invalid" });
    expect(await createBooking(stay({ checkIn: "2026-10-23", checkOut: "2026-10-23" }), NOW)).toEqual({ ok: false, error: "invalid" });
    expect(await createBooking(stay({ checkIn: "2026-13-01" }), NOW)).toEqual({ ok: false, error: "invalid" });
    expect(await createBooking(stay({ guests: 4 }), NOW)).toEqual({ ok: false, error: "invalid" });
    expect(await createBooking(stay({ listingId: "b", checkOut: "2026-10-21" }), NOW)).toEqual({ ok: false, error: "stayLength" });
    expect(await createBooking(stay({ listingId: "b", checkOut: "2026-10-27" }), NOW)).toEqual({ ok: false, error: "stayLength" });
    expect(await createBooking(stay({ listingId: "draft" }), NOW)).toEqual({ ok: false, error: "notFound" });
    expect(await createBooking(stay({ guestId: "host" }), NOW)).toEqual({ ok: false, error: "ownListing" });
    expect(await createBooking(stay({ payment: { method: "airtel", phone: "0781234567" } }), NOW)).toEqual({ ok: false, error: "phone" });
    expect(await db.booking.count()).toBe(0);
  });
});

describe("reading bookings", () => {
  it("lists only the guest's own bookings and hides other guests' references", async () => {
    const mine = await createBooking(stay(), NOW);
    await createBooking(stay({ guestId: "u2", checkIn: "2026-11-01", checkOut: "2026-11-02" }), NOW);
    const list = await guestBookings("u1", NOW);
    expect(list.map((b) => b.reference)).toEqual([mine.ok && mine.reference]);
    expect(list[0]).toMatchObject({ checkIn: "2026-10-20", checkOut: "2026-10-23", listing: { title: "Home a", city: "Kigali" } });
    expect(await getGuestBooking("u2", mine.ok ? mine.reference : "", NOW)).toBeNull();
    expect((await getGuestBooking("u1", mine.ok ? mine.reference : "", NOW))?.events).toHaveLength(1);
  });

  it("gives the calendar the nights still taken", async () => {
    await createBooking(stay(), NOW);
    expect(await bookedRanges("a", NOW)).toEqual([{ checkIn: "2026-10-20", checkOut: "2026-10-23" }]);
    expect(await bookedRanges("a", new Date(NOW.getTime() + 24 * 60 * 60 * 1000))).toEqual([]);
  });
});

describe("cancelPendingBooking", () => {
  it("lets the guest drop an unpaid hold, freeing the dates", async () => {
    const result = await createBooking(stay(), NOW);
    const reference = result.ok ? result.reference : "";
    expect(await cancelPendingBooking("u2", reference, NOW)).toBe(false);
    expect(await cancelPendingBooking("u1", reference, NOW)).toBe(true);
    expect(await cancelPendingBooking("u1", reference, NOW)).toBe(false);
    expect(await bookedRanges("a", NOW)).toEqual([]);
    const events = await db.bookingEvent.findMany({ where: { booking: { reference } }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => [e.fromStatus, e.toStatus])).toEqual([[null, "PENDING_PAYMENT"], ["PENDING_PAYMENT", "CANCELLED"]]);
  });
});

describe("staffMoveBooking", () => {
  it("checks a paid guest in from the check-in day, then out, and never an unpaid one", async () => {
    const result = await createBooking(stay(), NOW);
    const reference = result.ok ? result.reference : "";
    expect(await staffMoveBooking("host", reference, "CHECKED_IN", new Date("2026-10-20T10:00:00Z"))).toBe(false); // unpaid
    await db.booking.update({ where: { reference }, data: { status: "CONFIRMED" } });
    expect(await staffMoveBooking("host", reference, "CHECKED_IN", new Date("2026-10-19T10:00:00Z"))).toBe(false); // too early
    expect(await staffMoveBooking("host", reference, "COMPLETED", new Date("2026-10-20T10:00:00Z"))).toBe(false); // not in yet
    expect(await staffMoveBooking("host", reference, "CHECKED_IN", new Date("2026-10-20T10:00:00Z"))).toBe(true);
    expect(await staffMoveBooking("host", reference, "COMPLETED", new Date("2026-10-23T08:00:00Z"))).toBe(true);
    const events = await db.bookingEvent.findMany({ where: { booking: { reference } }, orderBy: { createdAt: "asc" } });
    expect(events.slice(-2).map((e) => [e.fromStatus, e.toStatus, e.actorId])).toEqual([
      ["CONFIRMED", "CHECKED_IN", "host"],
      ["CHECKED_IN", "COMPLETED", "host"],
    ]);
  });
});
