import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { markCleaningDone, requestCleaning } from "@/features/stay/cleaning";
import { sellerFor } from "@/features/receipt/service";
import { readEbm, uploadEbm } from "./ebm";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const NOW = new Date("2026-11-10T10:00:00Z");

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "host", name: "Host Hana", email: "host@example.com" },
      { id: "desk", name: "Desk", email: "desk@example.com" },
      { id: "guest", name: "Guest", email: "guest@example.com" },
      { id: "other", name: "Other", email: "other@example.com" },
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" },
    ],
  });
  await db.listing.create({ data: { id: "flat", hostId: "host", title: "Flat", description: "x", type: "APARTMENT", status: "PUBLISHED", addressLine: "x", district: "Gasabo", city: "Kigali", lat: -1.9, lng: 30, sizeM2: 40, rooms: 1, bedrooms: 1, bathrooms: 1, maxGuests: 2 } });
  await db.placeMember.create({ data: { listingId: "flat", userId: "desk", role: "RECEPTIONIST", addedById: "admin" } });
  await db.booking.create({
    data: { reference: "SR-EBM001", listingId: "flat", guestId: "guest", status: "CHECKED_IN", checkIn: new Date("2026-11-09"), checkOut: new Date("2026-11-12"), startAt: new Date("2026-11-09T12:00:00Z"), endAt: new Date("2026-11-12T09:00:00Z"), nights: 3, guests: 1, nightlyPrice: 40000, subtotal: 120000, total: 120000, hostPayout: 108000, policySnapshot: {} },
  });
});

describe("EBM receipts", () => {
  it("the place's team or VIIPA upload it (a real PDF or photo); the guest and the team download it", async () => {
    expect(await uploadEbm({ id: "other" }, "SR-EBM001", "ebm.pdf", PDF)).toEqual({ ok: false, error: "notAllowed" });
    expect(await uploadEbm({ id: "desk" }, "SR-EBM001", "ebm.pdf", new Uint8Array([1, 2, 3, 4]))).toEqual({ ok: false, error: "badType" });
    expect(await uploadEbm({ id: "desk" }, "SR-EBM001", "ebm.pdf", PDF)).toEqual({ ok: true });
    // A new one replaces the old.
    expect(await uploadEbm({ id: "host" }, "SR-EBM001", "ebm2.pdf", PDF)).toEqual({ ok: true });
    expect(await db.ebmReceipt.count()).toBe(1);
    expect((await readEbm({ id: "guest" }, "SR-EBM001"))?.filename).toBe("ebm2.pdf");
    expect(await readEbm({ id: "other" }, "SR-EBM001")).toBeNull();
    expect(await db.notification.count({ where: { userId: "guest", kind: "ebmReady" } })).toBe(2);
  });

  it("the seller is VIIPA when it runs the place, else the owner (their TIN)", async () => {
    expect(await sellerFor({ operator: "OWNER", hostId: "host" })).toBeNull();
    await db.payoutAccount.create({ data: { userId: "host", method: "MOBILE_MONEY", accountName: "Hana", accountNumber: "0788000000", tin: "123456789" } });
    expect(await sellerFor({ operator: "OWNER", hostId: "host" })).toEqual({ name: "Host Hana", tin: "123456789" });
    await db.platformConfig.upsert({ where: { id: 1 }, create: { id: 1, receiptBusinessName: "VIIPA Ltd", receiptTin: "987654321" }, update: { receiptBusinessName: "VIIPA Ltd", receiptTin: "987654321" } });
    expect(await sellerFor({ operator: "VIIPA", hostId: "host" })).toEqual({ name: "VIIPA Ltd", tin: "987654321" });
  });
});

describe("cleaning", () => {
  it("a guest staying asks once; the desk marks it done and the guest is told", async () => {
    expect(await requestCleaning("other", "SR-EBM001", "", NOW)).toEqual({ ok: false, error: "notFound" });
    expect(await requestCleaning("guest", "SR-EBM001", "After 2 pm", NOW)).toEqual({ ok: true });
    expect(await requestCleaning("guest", "SR-EBM001", "", NOW)).toEqual({ ok: false, error: "waiting" });
    expect(await db.notification.count({ where: { userId: { in: ["host", "desk"] }, kind: "cleaningRequested" } })).toBe(2);
    const req = await db.cleaningRequest.findFirstOrThrow();
    expect(await markCleaningDone({ id: "other" }, req.id, NOW)).toBe(false);
    expect(await markCleaningDone({ id: "desk" }, req.id, NOW)).toBe(true);
    expect(await db.notification.count({ where: { userId: "guest", kind: "cleaningDone" } })).toBe(1);
    expect(await requestCleaning("guest", "SR-EBM001", "", NOW)).toEqual({ ok: true });
  });
});
