import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { claimPayment, confirmPaymentByHand, rejectPaymentClaim } from "./manual";

const NOW = new Date("2026-10-15T08:00:00Z");

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "owner", name: "Owner", email: "owner@example.com" },
      { id: "desk", name: "Desk", email: "desk@example.com" },
      { id: "guest", name: "Guest", email: "guest@example.com" },
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" },
    ],
  });
  await db.listing.create({
    data: { id: "house", hostId: "owner", title: "House", description: "Nice", type: "PRIVATE_HOUSE", status: "PUBLISHED", addressLine: "KG 1", district: "Gasabo", city: "Kigali", lat: -1.95, lng: 30.06, sizeM2: 90, rooms: 3, bedrooms: 2, bathrooms: 1, maxGuests: 4 },
  });
  await db.placeMember.create({ data: { listingId: "house", userId: "desk", role: "RECEPTIONIST", addedById: "owner" } });
  await db.booking.create({
    data: {
      reference: "SR-PAY234",
      listingId: "house",
      guestId: "guest",
      status: "PENDING_PAYMENT",
      checkIn: new Date("2026-11-01T00:00:00Z"),
      checkOut: new Date("2026-11-03T00:00:00Z"),
      startAt: new Date("2026-11-01T12:00:00Z"),
      endAt: new Date("2026-11-03T09:00:00Z"),
      nights: 2,
      guests: 2,
      nightlyPrice: 50_000,
      subtotal: 100_000,
      total: 100_000,
      commission: 10_000,
      hostPayout: 90_000,
      holdExpiresAt: new Date(NOW.getTime() + 30 * 60_000),
      policySnapshot: {},
    },
  });
});

describe("payments confirmed by the owner or staff", () => {
  it("the guest says they paid; only the owner or staff confirm it, with the exact total", async () => {
    expect(await claimPayment("guest", "SR-PAY234", "MP2610.1234.A56789", NOW)).toEqual({ ok: true });
    const held = await db.booking.findUniqueOrThrow({ where: { reference: "SR-PAY234" } });
    expect(held.holdExpiresAt!.getTime()).toBeGreaterThan(NOW.getTime() + 23 * 3_600_000);
    expect(await db.notification.count({ where: { userId: "owner", kind: "paymentClaim" } })).toBe(1);

    expect(await confirmPaymentByHand({ id: "desk" }, "SR-PAY234", { transactionId: "MP2610.1234.A56789", amount: 100_000 })).toEqual({ ok: false, error: "notAllowed" });
    expect(await confirmPaymentByHand({ id: "owner" }, "SR-PAY234", { transactionId: "MP2610.1234.A56789", amount: 90_000 })).toEqual({ ok: false, error: "amount" });
    expect(await confirmPaymentByHand({ id: "owner" }, "SR-PAY234", { transactionId: "MP2610.1234.A56789", amount: 100_000 })).toEqual({ ok: true });

    expect((await db.booking.findUniqueOrThrow({ where: { reference: "SR-PAY234" } })).status).toBe("CONFIRMED");
    expect(await db.payment.findMany({ select: { status: true, providerReference: true } })).toEqual([{ status: "SUCCEEDED", providerReference: "MP2610.1234.A56789" }]);
    expect(await db.ledgerEntry.count({ where: { kind: "GUEST_PAYMENT" } })).toBe(1);
    expect(await db.bookingEvent.findFirst({ where: { toStatus: "CONFIRMED" } })).toMatchObject({ actorId: "owner" });
  });

  it("staff can confirm without a claim, and a claim can be turned down with a reason", async () => {
    await claimPayment("guest", "SR-PAY234", "TX-WRONG-1", NOW);
    expect(await rejectPaymentClaim({ id: "admin", role: "ADMIN" }, "SR-PAY234", "")).toBe(false);
    expect(await rejectPaymentClaim({ id: "admin", role: "ADMIN" }, "SR-PAY234", "Not in our statement")).toBe(true);
    expect(await db.notification.count({ where: { userId: "guest", kind: "paymentNotReceived" } })).toBe(1);
    expect(await confirmPaymentByHand({ id: "admin", role: "ADMIN" }, "SR-PAY234", { transactionId: "TX-RIGHT-2", amount: 100_000 })).toEqual({ ok: true });
  });
});
