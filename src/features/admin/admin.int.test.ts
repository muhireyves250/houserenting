import { beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/features/bookings/service";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { bookingsCsv, searchBookings, setUserStatus, staffCancelUnpaid } from "./queries";

const NOW = new Date("2026-10-15T08:00:00Z");
const pay = { method: "mtn" as const, phone: "0788123456" };

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN", emailVerified: true },
      { id: "host", name: "Host", email: "host@example.com" },
      { id: "g1", name: "Eric Guest", email: "eric@example.com" },
    ],
  });
  await db.listing.create({
    data: {
      id: "flat",
      hostId: "host",
      title: "City flat",
      description: "Nice",
      type: "APARTMENT",
      status: "PUBLISHED",
      addressLine: "KG 1",
      district: "Gasabo",
      city: "Kigali",
      lat: -1.95,
      lng: 30.06,
      sizeM2: 60,
      rooms: 3,
      bedrooms: 2,
      bathrooms: 1,
      maxGuests: 4,
      rates: { create: [{ unit: "NIGHT", price: 50000 }] },
    },
  });
});

describe("staff tools", () => {
  it("find bookings by guest or reference and filter by status; export them as CSV", async () => {
    const r = await createBooking({ guestId: "g1", listingId: "flat", checkIn: "2026-11-01", checkOut: "2026-11-03", guests: 1, payment: pay }, NOW);
    const reference = r.ok ? r.reference : "";
    expect((await searchBookings({ q: "eric" })).rows.map((b) => b.reference)).toEqual([reference]);
    expect((await searchBookings({ q: reference.toLowerCase() })).total).toBe(1);
    expect((await searchBookings({ status: "CONFIRMED" })).total).toBe(0);
    expect((await searchBookings({})).counts).toEqual({ PENDING_PAYMENT: 1 });
    expect(await bookingsCsv()).toContain(`"${reference}","PENDING_PAYMENT"`);
  });

  it("release an unpaid hold only with a reason, and tell the guest", async () => {
    const r = await createBooking({ guestId: "g1", listingId: "flat", checkIn: "2026-11-01", checkOut: "2026-11-03", guests: 1, payment: pay }, NOW);
    const reference = r.ok ? r.reference : "";
    expect(await staffCancelUnpaid("admin", reference, "  ")).toBe(false);
    expect(await staffCancelUnpaid("admin", reference, "Guest asked by phone")).toBe(true);
    expect(await staffCancelUnpaid("admin", reference, "again")).toBe(false);
    const booking = await db.booking.findUniqueOrThrow({ where: { reference }, include: { events: true } });
    expect(booking.status).toBe("CANCELLED");
    expect(booking.events.at(-1)).toMatchObject({ actorId: "admin", reason: "Guest asked by phone" });
    expect(await db.notification.findFirst({ where: { userId: "g1", kind: "bookingCancelled" } })).not.toBeNull();
  });

  it("suspend an account: signed out everywhere, can't sign in, and never yourself", async () => {
    await auth.api.signUpEmail({ body: { name: "Sue", email: "sue@example.com", password: "Long-enough-pass-1" } });
    const sue = await db.user.findUniqueOrThrow({ where: { email: "sue@example.com" } });
    await db.user.update({ where: { id: sue.id }, data: { emailVerified: true } });
    await auth.api.signInEmail({ body: { email: "sue@example.com", password: "Long-enough-pass-1" } });
    expect(await db.session.count({ where: { userId: sue.id } })).toBeGreaterThan(0);

    expect(await setUserStatus("admin", "admin", "SUSPENDED", "testing")).toBe(false);
    expect(await setUserStatus("admin", sue.id, "SUSPENDED", "")).toBe(false);
    expect(await setUserStatus("admin", sue.id, "SUSPENDED", "Fake listings")).toBe(true);
    expect(await db.session.count({ where: { userId: sue.id } })).toBe(0);
    await expect(auth.api.signInEmail({ body: { email: "sue@example.com", password: "Long-enough-pass-1" } })).rejects.toMatchObject({ body: { code: "ACCOUNT_SUSPENDED" } });

    expect(await setUserStatus("admin", sue.id, "ACTIVE", "")).toBe(true);
    await expect(auth.api.signInEmail({ body: { email: "sue@example.com", password: "Long-enough-pass-1" } })).resolves.toBeTruthy();
    const log = await db.auditLog.findMany({ where: { entityId: sue.id }, orderBy: { createdAt: "asc" } });
    expect(log.map((l) => l.action)).toEqual(["user.suspend", "user.reactivate"]);
  });
});
