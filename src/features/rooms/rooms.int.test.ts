import { beforeEach, describe, expect, it } from "vitest";
import { bookedRanges, createBooking } from "@/features/bookings/service";
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
    expect(await setRoomStatus(host, roomA, "CLEANING")).toBe(true);
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

  it("sends a live place back to review when its rooms change, and keeps booked rooms in history", async () => {
    await saveRoom(host, "lodge", roomA, { ...room, name: "Room A (garden)", rates: [{ unit: "NIGHT", price: 45000 }] });
    expect((await db.listing.findUnique({ where: { id: "lodge" } }))?.status).toBe("PENDING_REVIEW");
    await db.listing.update({ where: { id: "lodge" }, data: { status: "PUBLISHED" } });
    await createBooking(stay({ roomId: roomA }), NOW);
    expect(await removeRoom(host, roomA)).toBe("disabled");
    expect(await removeRoom(host, roomB)).toBe("deleted");
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
