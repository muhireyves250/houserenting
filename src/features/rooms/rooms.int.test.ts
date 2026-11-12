import { beforeEach, describe, expect, it } from "vitest";
import { bookedForRoom, bookedRanges, bookedRoomNumbers, createBooking, createRentalBooking } from "@/features/bookings/service";
import { roomStatusOn } from "./availability";
import { updateSettings } from "@/features/settings/service";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { removeRoom, saveRoom, setRoomStatus } from "./service";

const NOW = new Date("2026-10-15T08:00:00Z");
const pay = { method: "mtn" as const, phone: "0788123456" };
const stay = (over: Record<string, unknown> = {}) => ({ guestId: "g1", listingId: "lodge", checkIn: "2026-11-01", checkOut: "2026-11-03", guests: 1, payment: pay, ...over });
const host = { id: "host" };
const room = { description: "", maxGuests: 2, facilities: [] as never[] };

let roomA = "";
let roomB = "";

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "host", name: "Host", email: "host@example.com" },
      { id: "g1", name: "Guest 1", email: "g1@example.com" },
      { id: "g2", name: "Guest 2", email: "g2@example.com" },
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" },
    ],
  });
  await db.listing.create({
    data: {
      id: "lodge",
      hostId: "host",
      title: "Lake lodge",
      description: "Rooms by the lake",
      type: "LODGE",
      status: "DRAFT",
      bookingModel: "BOTH",
      addressLine: "Main road",
      district: "Rubavu",
      city: "Gisenyi",
      lat: -1.7,
      lng: 29.26,
      sizeM2: 300,
      rooms: 6,
      bedrooms: 4,
      bathrooms: 4,
      maxGuests: 8,
      rates: { create: [{ unit: "NIGHT", price: 200000, minUnits: 1 }] },
    },
  });
  const a = await saveRoom(host, "lodge", null, { ...room, name: "Room A", rates: [{ unit: "NIGHT", price: 40000 }] });
  const b = await saveRoom(host, "lodge", null, { ...room, name: "Room B", rates: [{ unit: "NIGHT", price: 50000 }] });
  roomA = a.ok ? a.id : "";
  roomB = b.ok ? b.id : "";
  await db.listing.update({ where: { id: "lodge" }, data: { status: "PUBLISHED" } });
});

describe("room-by-room and whole-place bookings", () => {
  it("a lodge room can be booked by the hour, but not for a time that has already passed", async () => {
    await db.listing.update({ where: { id: "lodge" }, data: { rates: { create: [{ unit: "HOUR", price: 10000, minUnits: 1, maxUnits: 8, dayStartTime: "07:00", dayEndTime: "22:00" }] } } });
    await saveRoom({ id: "admin", role: "ADMIN" }, "lodge", roomA, { ...room, name: "Room A", rates: [{ unit: "NIGHT", price: 40000 }, { unit: "HOUR", price: 5000 }] });
    const hour = { guestId: "g1", listingId: "lodge", unit: "HOUR" as const, quantity: 2, guests: 1, payment: pay, roomId: roomA };
    expect((await createRentalBooking({ ...hour, start: "2026-11-05", startTime: "10:00" }, NOW)).ok).toBe(true);
    expect(await db.booking.findFirstOrThrow({ where: { roomId: roomA } })).toMatchObject({ unit: "HOUR", subtotal: 10000 });
    // NOW is 10:00 in Kigali on Oct 15: 09:00 that day has passed.
    expect(await createRentalBooking({ ...hour, guestId: "g2", start: "2026-10-15", startTime: "09:00" }, NOW)).toEqual({ ok: false, error: "pastTime" });
  });

  it("a room type with numbered rooms gives each guest a free number, and is only booked when all are taken", async () => {
    await saveRoom({ id: "admin", role: "ADMIN" }, "lodge", roomA, { ...room, name: "Garden Double", rates: [{ unit: "NIGHT", price: 40000 }], numbers: ["101", "102"] });
    expect((await createBooking(stay({ roomId: roomA }), NOW)).ok).toBe(true);
    expect(roomStatusOn(await bookedRanges("lodge", NOW), roomA, "2026-11-01")).toEqual({ free: true }); // one of two left
    expect((await createBooking(stay({ guestId: "g2", roomId: roomA }), NOW)).ok).toBe(true);
    expect(await createBooking(stay({ guestId: "g2", roomId: roomA, checkIn: "2026-11-02", checkOut: "2026-11-04" }), NOW)).toEqual({ ok: false, error: "unavailable" });
    const numbers = (await db.booking.findMany({ where: { roomId: roomA }, select: { roomNumber: true } })).map((b) => b.roomNumber).sort();
    expect(numbers).toEqual(["101", "102"]);
    expect(roomStatusOn(await bookedRanges("lodge", NOW), roomA, "2026-11-01")).toEqual({ free: false, freeFrom: "2026-11-03" });
  });

  it("each numbered room is booked on its own: a guest can pick a free one, never one someone holds", async () => {
    await saveRoom({ id: "admin", role: "ADMIN" }, "lodge", roomA, { ...room, name: "Garden Double", rates: [{ unit: "NIGHT", price: 40000 }], numbers: ["101", "102", "103"] });
    const night = { listingId: "lodge", unit: "NIGHT" as const, start: "2026-11-01", quantity: 2, guests: 1, payment: pay, roomId: roomA };
    expect((await createRentalBooking({ ...night, guestId: "g1", roomNumber: "103" }, NOW)).ok).toBe(true);
    expect(await createRentalBooking({ ...night, guestId: "g2", roomNumber: "103" }, NOW)).toEqual({ ok: false, error: "unavailable" });
    expect(await createRentalBooking({ ...night, guestId: "g2", roomNumber: "999" }, NOW)).toEqual({ ok: false, error: "unavailable" });
    expect((await createRentalBooking({ ...night, guestId: "g2", roomNumber: "101" }, NOW)).ok).toBe(true);
    expect((await bookedRoomNumbers("lodge", NOW)).map((b) => b.roomNumber).sort()).toEqual(["101", "103"]);
  });

  it("each room of a place has its own name or number, never in two room types", async () => {
    const admin = { id: "admin", role: "ADMIN" };
    expect((await saveRoom(admin, "lodge", roomA, { ...room, name: "First floor", rates: [{ unit: "NIGHT", price: 40000 }], numbers: ["101", "Lake Kivu"] })).ok).toBe(true);
    expect(await saveRoom(admin, "lodge", roomB, { ...room, name: "Second floor", rates: [{ unit: "NIGHT", price: 40000 }], numbers: ["201", "lake kivu"] })).toEqual({ ok: false, errors: { numbers: "taken:lake kivu" } });
    expect((await saveRoom(admin, "lodge", roomB, { ...room, name: "Second floor", rates: [{ unit: "NIGHT", price: 40000 }], numbers: ["201", "202"] })).ok).toBe(true);
    // Saving a type again with its own rooms is fine.
    expect((await saveRoom(admin, "lodge", roomA, { ...room, name: "First floor", rates: [{ unit: "NIGHT", price: 40000 }], numbers: ["101", "Lake Kivu", "102"] })).ok).toBe(true);
  });

  it("saves each room's own photos and description with its room type", async () => {
    const details = { "101": { photos: ["https://res.cloudinary.com/demo/101.jpg"], description: "Corner room" } };
    await saveRoom({ id: "admin", role: "ADMIN" }, "lodge", roomA, { ...room, name: "First floor", rates: [{ unit: "NIGHT", price: 40000 }], numbers: ["101", "102"], unitDetails: details });
    expect((await db.room.findUnique({ where: { id: roomA }, select: { unitDetails: true } }))?.unitDetails).toEqual(details);
  });

  it("a room's own calendar shows only that room's bookings (and the whole place's)", async () => {
    await saveRoom({ id: "admin", role: "ADMIN" }, "lodge", roomA, { ...room, name: "Garden Double", rates: [{ unit: "NIGHT", price: 40000 }], numbers: ["101", "102"] });
    const night = { listingId: "lodge", unit: "NIGHT" as const, start: "2026-11-01", quantity: 2, guests: 1, payment: pay, roomId: roomA };
    expect((await createRentalBooking({ ...night, guestId: "g1", roomNumber: "101" }, NOW)).ok).toBe(true);
    const days = async (n: string) => (await bookedForRoom("lodge", roomA, n, NOW)).map((r) => `${r.checkIn}/${r.checkOut}`);
    expect(await days("101")).toEqual(["2026-11-01/2026-11-03"]);
    expect(await days("102")).toEqual([]);
  });

  it("books a room for day use (no night) and shows it booked for that day only", async () => {
    await db.listing.update({ where: { id: "lodge" }, data: { rates: { create: [{ unit: "DAY", price: 100000, minUnits: 1, dayStartTime: "08:00", dayEndTime: "20:00" }] } } });
    await saveRoom({ id: "admin", role: "ADMIN" }, "lodge", roomA, { ...room, name: "Room A", rates: [{ unit: "NIGHT", price: 40000 }, { unit: "DAY", price: 20000 }] });
    const day = { guestId: "g1", listingId: "lodge", unit: "DAY" as const, start: "2026-11-05", quantity: 1, guests: 1, payment: pay };
    expect((await createRentalBooking({ ...day, roomId: roomA }, NOW)).ok).toBe(true);
    expect(await db.booking.findFirstOrThrow({ where: { roomId: roomA } })).toMatchObject({ unit: "DAY", subtotal: 20000 });
    expect(await createRentalBooking({ ...day, guestId: "g2", roomId: roomA }, NOW)).toEqual({ ok: false, error: "unavailable" });

    const taken = await bookedRanges("lodge", NOW);
    expect(roomStatusOn(taken, roomA, "2026-11-05")).toEqual({ free: false, freeFrom: "2026-11-06" });
    expect(roomStatusOn(taken, roomA, "2026-11-06")).toEqual({ free: true });
    expect(roomStatusOn(taken, roomB, "2026-11-05")).toEqual({ free: true });
  });

  it("lets different rooms be booked for the same nights, but not the same room twice", async () => {
    expect((await createBooking(stay({ roomId: roomA }), NOW)).ok).toBe(true);
    expect((await createBooking(stay({ guestId: "g2", roomId: roomB }), NOW)).ok).toBe(true);
    expect(await createBooking(stay({ guestId: "g2", roomId: roomA, checkIn: "2026-11-02", checkOut: "2026-11-04" }), NOW)).toEqual({
      ok: false,
      error: "unavailable",
    });
    const booking = await db.booking.findFirstOrThrow({ where: { roomId: roomB } });
    expect(booking).toMatchObject({ nightlyPrice: 50000, subtotal: 100000, total: 100000 });
  });

  it("refuses the whole place while any room is taken, and any room while the whole place is taken", async () => {
    await createBooking(stay({ roomId: roomA }), NOW);
    expect(await createBooking(stay({ guestId: "g2" }), NOW)).toEqual({ ok: false, error: "unavailable" });
    expect((await createBooking(stay({ guestId: "g2", checkIn: "2026-11-10", checkOut: "2026-11-12" }), NOW)).ok).toBe(true);
    expect(await createBooking(stay({ roomId: roomB, checkIn: "2026-11-11", checkOut: "2026-11-13" }), NOW)).toEqual({ ok: false, error: "unavailable" });
  });

  it("never lets a whole-place booking and a room booking for the same nights both through at once", async () => {
    const results = await Promise.all([createBooking(stay({ roomId: roomA }), NOW), createBooking(stay({ guestId: "g2" }), NOW)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("doesn't book rooms that are being cleaned or repaired, and logs status changes", async () => {
    expect(await setRoomStatus({ id: "g1" }, roomA, "CLEANING")).toBe(false);
    // A live place's rooms are VIIPA's to manage, not the owner's.
    expect(await setRoomStatus(host, roomA, "CLEANING")).toBe(false);
    expect(await setRoomStatus({ id: "admin", role: "ADMIN" }, roomA, "CLEANING")).toBe(true);
    expect(await createBooking(stay({ roomId: roomA }), NOW)).toEqual({ ok: false, error: "unavailable" });
    expect(await setRoomStatus({ id: "admin", role: "ADMIN" }, roomA, "AVAILABLE")).toBe(true);
    expect((await createBooking(stay({ roomId: roomA }), NOW)).ok).toBe(true);
    const log = await db.auditLog.findMany({ where: { action: "room.status" }, orderBy: { createdAt: "asc" } });
    expect(log.map((l) => (l.data as { to: string }).to)).toEqual(["CLEANING", "AVAILABLE"]);
  });

  it("gives the calendar each booking's room", async () => {
    await createBooking(stay({ roomId: roomA }), NOW);
    expect(await bookedRanges("lodge", NOW)).toEqual([{ checkIn: "2026-11-01", checkOut: "2026-11-03", roomId: roomA }]);
  });

  it("follows the place's booking model", async () => {
    await db.listing.update({ where: { id: "lodge" }, data: { bookingModel: "ROOM_BY_ROOM" } });
    expect(await createBooking(stay(), NOW)).toEqual({ ok: false, error: "notFound" });
    await db.listing.update({ where: { id: "lodge" }, data: { bookingModel: "WHOLE_PROPERTY" } });
    expect(await createBooking(stay({ roomId: roomA }), NOW)).toEqual({ ok: false, error: "notFound" });
  });

  it("only staff change a live place's rooms (it stays live), and booked rooms stay in history", async () => {
    const staff = { id: "admin", role: "ADMIN" };
    expect((await saveRoom(host, "lodge", roomA, { ...room, name: "Room A (garden)", rates: [{ unit: "NIGHT", price: 45000 }] })).ok).toBe(false);
    expect((await saveRoom(staff, "lodge", roomA, { ...room, name: "Room A (garden)", rates: [{ unit: "NIGHT", price: 45000 }] })).ok).toBe(true);
    expect((await db.listing.findUnique({ where: { id: "lodge" } }))?.status).toBe("PUBLISHED");
    await createBooking(stay({ roomId: roomA }), NOW);
    expect(await removeRoom(host, roomA)).toBe(false);
    expect(await removeRoom(staff, roomA)).toBe("disabled");
    expect(await removeRoom(staff, roomB)).toBe("deleted");
    expect(await removeRoom({ id: "g1" }, roomA)).toBe(false);
  });
});

describe("fees and policy from settings", () => {
  it("splits the price with the settings in force and snapshots the policy", async () => {
    const result = await updateSettings("admin", {
      commissionPercent: 10,
      guestFeePercent: 5,
      holdMinutes: 15,
      monthlyDepositPercent: null,
      cancellationPolicy: { en: "Free cancellation up to 48 hours before check-in.", fr: null, rw: null },
    });
    expect(result).toEqual({ ok: true });
    await createBooking(stay({ roomId: roomA }), NOW);
    const b = await db.booking.findFirstOrThrow();
    expect(b).toMatchObject({ subtotal: 80000, guestFee: 4000, total: 84000, commission: 8000, hostPayout: 72000 });
    expect(b.holdExpiresAt?.getTime()).toBe(NOW.getTime() + 15 * 60_000);
    expect(b.policySnapshot).toMatchObject({
      room: "Room A",
      fees: { commissionBps: 1000, guestFeeBps: 500 },
      cancellationPolicy: { en: "Free cancellation up to 48 hours before check-in." },
    });
    expect(await db.auditLog.findFirst({ where: { action: "settings.update" } })).toMatchObject({ actorId: "admin" });

    // Later changes don't touch existing bookings.
    await updateSettings("admin", { commissionPercent: 20, guestFeePercent: null, holdMinutes: null, monthlyDepositPercent: null, cancellationPolicy: { en: null, fr: null, rw: null } });
    expect(await db.booking.findFirstOrThrow()).toMatchObject({ commission: 8000, total: 84000 });
  });

  it("rejects out-of-range settings", async () => {
    const result = await updateSettings("admin", { commissionPercent: 80, guestFeePercent: -1, holdMinutes: 2, monthlyDepositPercent: null, cancellationPolicy: { en: null, fr: null, rw: null } });
    expect(result.ok).toBe(false);
  });
});
