import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createRentalBooking, type RentalRequest } from "./service";

const NOW = new Date("2026-10-15T08:00:00Z");
const pay = { method: "mtn" as const, phone: "0788123456" };

async function place(id: string, type: "PRIVATE_HOUSE" | "LODGE", rates: { unit: "HOUR" | "DAY" | "NIGHT" | "WEEK" | "MONTH" | "YEAR"; price: number; dayStartTime?: string; dayEndTime?: string }[]) {
  await db.listing.create({
    data: {
      id,
      hostId: "host",
      title: `Place ${id}`,
      description: "Nice",
      type,
      status: "PUBLISHED",
      addressLine: "KG 1",
      district: "Gasabo",
      city: "Kigali",
      lat: -1.95,
      lng: 30.06,
      sizeM2: 90,
      rooms: 4,
      bedrooms: 3,
      bathrooms: 2,
      maxGuests: 6,
      rates: { create: rates },
    },
  });
}

const book = (over: Partial<RentalRequest>) =>
  createRentalBooking({ guestId: "g1", listingId: "house", unit: "NIGHT", start: "2026-11-02", quantity: 1, guests: 2, payment: pay, ...over }, NOW);

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "host", name: "Host", email: "host@example.com" },
      { id: "g1", name: "Guest 1", email: "g1@example.com" },
      { id: "g2", name: "Guest 2", email: "g2@example.com" },
    ],
  });
  await place("house", "PRIVATE_HOUSE", [
    { unit: "HOUR", price: 10000, dayStartTime: "08:00", dayEndTime: "20:00" },
    { unit: "DAY", price: 60000 },
    { unit: "NIGHT", price: 80000 },
    { unit: "WEEK", price: 450000 },
    { unit: "YEAR", price: 9600000 },
  ]);
});

describe("booking by hour, day, week and year", () => {
  it("prices each unit from the host's rates and stores exact times", async () => {
    expect((await book({ unit: "HOUR", startTime: "09:00", quantity: 3 })).ok).toBe(true);
    expect((await book({ unit: "WEEK", start: "2026-12-01", quantity: 2 })).ok).toBe(true);
    const hour = await db.booking.findFirstOrThrow({ where: { unit: "HOUR" } });
    expect(hour).toMatchObject({ quantity: 3, nightlyPrice: 10000, subtotal: 30000 });
    expect([hour.startAt.toISOString(), hour.endAt.toISOString()]).toEqual(["2026-11-02T07:00:00.000Z", "2026-11-02T10:00:00.000Z"]);
    expect(await db.booking.findFirstOrThrow({ where: { unit: "WEEK" } })).toMatchObject({ subtotal: 900000 });
  });

  it("lets two hourly bookings share a day without overlapping, and refuses overlaps across units", async () => {
    expect((await book({ unit: "HOUR", startTime: "09:00", quantity: 2 })).ok).toBe(true);
    expect((await book({ guestId: "g2", unit: "HOUR", startTime: "11:00", quantity: 2 })).ok).toBe(true);
    expect(await book({ guestId: "g2", unit: "HOUR", startTime: "10:00", quantity: 2 })).toEqual({ ok: false, error: "unavailable" });
    expect(await book({ guestId: "g2", unit: "NIGHT" })).toEqual({ ok: false, error: "unavailable" });
    expect((await book({ guestId: "g2", unit: "DAY", start: "2026-11-03" })).ok).toBe(true);
  });

  it("keeps hours inside opening times and only offers the units the host set", async () => {
    expect(await book({ unit: "HOUR", startTime: "19:00", quantity: 2 })).toEqual({ ok: false, error: "stayLength" });
    expect(await book({ unit: "HOUR", startTime: null, quantity: 2 })).toEqual({ ok: false, error: "invalid" });
    expect(await book({ unit: "MONTH", quantity: 6 })).toEqual({ ok: false, error: "notOffered" });
    expect((await book({ unit: "YEAR", start: "2027-01-01", quantity: 1 })).ok).toBe(true);
    expect(await db.booking.findFirstOrThrow({ where: { unit: "YEAR" } })).toMatchObject({ months: 12, subtotal: 9600000 });
  });

  it("books lodges by the night or the day only", async () => {
    await place("lodge", "LODGE", [{ unit: "NIGHT", price: 40000 }, { unit: "DAY", price: 30000 }, { unit: "WEEK", price: 200000 }]);
    expect((await book({ listingId: "lodge", unit: "DAY", quantity: 2 })).ok).toBe(true);
    expect(await book({ listingId: "lodge", unit: "WEEK", start: "2026-12-01" })).toEqual({ ok: false, error: "notOffered" });
  });

  it("books a room at the room's own price for the chosen unit", async () => {
    await db.listing.update({ where: { id: "house" }, data: { bookingModel: "BOTH" } });
    const room = await db.room.create({
      data: { listingId: "house", name: "Garden room", maxGuests: 2, rates: { create: [{ unit: "NIGHT", price: 30000 }, { unit: "DAY", price: 20000 }] } },
    });
    expect((await book({ roomId: room.id, unit: "DAY", quantity: 2 })).ok).toBe(true);
    expect(await db.booking.findFirstOrThrow({ where: { roomId: room.id } })).toMatchObject({ nightlyPrice: 20000, subtotal: 40000 });
    expect(await book({ roomId: room.id, unit: "WEEK", start: "2026-12-01" })).toEqual({ ok: false, error: "notOffered" });
  });
});
