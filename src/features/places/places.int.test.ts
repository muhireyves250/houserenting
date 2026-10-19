import { beforeEach, describe, expect, it } from "vitest";
import { createRentalBooking, type RentalRequest } from "@/features/bookings/service";
import { saveListing } from "@/features/hosting/service";
import { getPublishedListing, highlightedListings } from "@/features/listings/service";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { createBlock, endBlock, listingBlocks } from "./blocks-service";
import { readDocument, uploadDocument } from "./documents-service";
import { savePayoutAccount, verifyPayoutAccount } from "./payout-service";
import { contractsEnding, moveListing, remindContractsEnding, updatePlaceAdmin } from "./status-service";

const NOW = new Date("2026-10-15T08:00:00Z");
const pay = { method: "mtn" as const, phone: "0788123456" };
const admin = { id: "admin", role: "ADMIN" };
const host = { id: "host" };
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

async function place(status: "DRAFT" | "PUBLISHED" = "PUBLISHED") {
  await db.listing.create({
    data: {
      id: "house",
      hostId: "host",
      title: "Lake house",
      description: "Nice",
      type: "PRIVATE_HOUSE",
      status,
      addressLine: "KG 1",
      district: "Rubavu",
      city: "Gisenyi",
      lat: -1.7,
      lng: 29.26,
      sizeM2: 90,
      rooms: 4,
      bedrooms: 3,
      bathrooms: 2,
      maxGuests: 6,
      rates: { create: [{ unit: "NIGHT", price: 80000 }] },
    },
  });
}

const book = (over: Partial<RentalRequest> = {}) =>
  createRentalBooking({ guestId: "guest", listingId: "house", unit: "NIGHT", start: "2026-11-02", quantity: 2, guests: 2, payment: pay, ...over }, NOW);

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "host", name: "Host", email: "host@example.com" },
      { id: "guest", name: "Guest", email: "guest@example.com" },
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" },
    ],
  });
});

describe("listing status", () => {
  it("won't publish an owner's place until their payout details are verified", async () => {
    await place("DRAFT");
    expect(await moveListing(admin, "house", "publishDirect")).toEqual({ ok: false, error: "payoutMissing" });
    expect((await savePayoutAccount("host", { method: "BANK", accountName: "Host", accountNumber: "0001234", bankName: null })).ok).toBe(false); // bank needs a name
    expect((await savePayoutAccount("host", { method: "MOBILE_MONEY", accountName: "Host", accountNumber: "0788000000", bankName: null })).ok).toBe(true);
    expect(await moveListing(admin, "house", "publishDirect")).toEqual({ ok: false, error: "payoutMissing" });
    expect(await verifyPayoutAccount("admin", "host")).toBe(true);
    expect(await moveListing(admin, "house", "publishDirect")).toEqual({ ok: true });
    expect(await getPublishedListing("house")).not.toBeNull();
  });

  it("publishes VIIPA-run places without owner payout details", async () => {
    await place("DRAFT");
    await updatePlaceAdmin("admin", "house", { contractStart: null, contractEnd: null, featured: true, operator: "VIIPA" });
    expect(await moveListing(admin, "house", "publishDirect")).toEqual({ ok: true });
    expect((await highlightedListings()).map((l) => l.id)).toEqual(["house"]);
  });

  it("hidden places can't be booked, and owners can't unhide them", async () => {
    await place();
    expect(await moveListing(admin, "house", "hide")).toEqual({ ok: false, error: "reasonNeeded" });
    expect(await moveListing(admin, "house", "hide", "Guest complaints")).toEqual({ ok: true });
    expect(await book()).toEqual({ ok: false, error: "notFound" });
    expect(await moveListing(host, "house", "unhide")).toEqual({ ok: false, error: "notAllowed" });
    expect(await db.notification.findFirst({ where: { userId: "host" } })).toMatchObject({ kind: "listingStatus", data: { status: "HIDDEN", reason: "Guest complaints" } });
    expect(await moveListing(admin, "house", "unhide")).toEqual({ ok: true });
    expect((await book()).ok).toBe(true);
  });

  it("owners pause and resume their own place", async () => {
    await place();
    expect(await moveListing({ id: "guest" }, "house", "pause")).toEqual({ ok: false, error: "notAllowed" });
    expect(await moveListing(host, "house", "pause")).toEqual({ ok: true });
    expect(await book()).toEqual({ ok: false, error: "notFound" });
    expect(await moveListing(host, "house", "resume")).toEqual({ ok: true });
  });

  it("staff edits keep a live place live", async () => {
    await place();
    const input = {
      title: "Lake house, renovated",
      description: "Freshly renovated house by the lake.",
      type: "PRIVATE_HOUSE" as const,
      bookingModel: "WHOLE_PROPERTY" as const,
      addressLine: "KG 1",
      district: "Rubavu",
      city: "Gisenyi",
      lat: -1.7,
      lng: 29.26,
      sizeM2: 90,
      rooms: 4,
      bedrooms: 3,
      bathrooms: 2,
      maxGuests: 6,
      petsAllowed: false,
      facilities: [],
      characteristics: [],
      termsOfRent: [],
      depositMonths: null,
      discountPercent: null,
      rates: [{ unit: "NIGHT" as const, price: 90000, minUnits: 1, maxUnits: null }],
    };
    expect(await saveListing("host", "house", input, { staffId: "admin" })).toEqual({ ok: true, id: "house" });
    expect((await getPublishedListing("house"))?.title).toBe("Lake house, renovated");
  });
});

describe("bookable dates", () => {
  it("refuses stays outside the management agreement and on closed days", async () => {
    await place();
    await updatePlaceAdmin("admin", "house", { contractStart: "2026-10-01", contractEnd: "2026-11-30", featured: false, operator: "OWNER" });
    expect(await book({ start: "2026-11-29", quantity: 3 })).toEqual({ ok: false, error: "outsideWindow" });
    expect((await book({ start: "2026-11-28", quantity: 2 })).ok).toBe(true);
    // Bookings may start on Mondays only (2026-11-02 is a Monday).
    await db.listing.update({ where: { id: "house" }, data: { workingDays: [1] } });
    expect(await book({ start: "2026-11-03", quantity: 1 })).toEqual({ ok: false, error: "closedDay" });
    expect((await book({ start: "2026-11-02", quantity: 1 })).ok).toBe(true);
  });

  it("maintenance blocks bookings, keeps history, and opens again when ended", async () => {
    await place();
    const result = await createBlock(host, "house", { roomId: null, kind: "MAINTENANCE", startsAt: new Date("2026-11-01T00:00:00Z"), endsAt: null, reason: "Roof repair" });
    expect(result).toEqual({ ok: true, overlapping: 0 });
    expect(await createBlock({ id: "guest" }, "house", { roomId: null, kind: "MAINTENANCE", startsAt: NOW, endsAt: null, reason: "x" })).toEqual({ ok: false, error: "notAllowed" });
    expect(await book()).toEqual({ ok: false, error: "unavailable" });
    const { active } = await listingBlocks("house", NOW);
    expect(await endBlock(admin, active[0]!.id, NOW)).toBe(true);
    expect((await book()).ok).toBe(true);
    expect((await listingBlocks("house", NOW)).past).toHaveLength(1);
  });

  it("reminds staff and the owner 30 days before an agreement ends", async () => {
    await place();
    await updatePlaceAdmin("admin", "house", { contractStart: "2026-01-01", contractEnd: "2026-11-14", featured: false, operator: "OWNER" });
    expect((await contractsEnding(NOW)).map((l) => l.id)).toEqual(["house"]);
    expect(await remindContractsEnding(NOW)).toBe(1);
    expect(await db.notification.count({ where: { kind: "contractEnding" } })).toBe(2);
    expect(await remindContractsEnding(new Date("2026-10-16T08:00:00Z"))).toBe(0);
  });
});

describe("documents", () => {
  it("only the owner and staff can open them, and only real PDFs or images are kept", async () => {
    await place();
    expect(await uploadDocument(host, "house", "OWNER_ID", "id.pdf", new TextEncoder().encode("not a pdf"))).toEqual({ ok: false, error: "badType" });
    expect(await uploadDocument({ id: "guest" }, "house", "OWNER_ID", "id.pdf", PDF)).toEqual({ ok: false, error: "notAllowed" });
    const up = await uploadDocument(host, "house", "OWNER_ID", "id.pdf", PDF);
    if (!up.ok) throw new Error("upload failed");
    expect(await readDocument({ id: "guest" }, up.id)).toBeNull();
    expect((await readDocument(admin, up.id))?.mimeType).toBe("application/pdf");
    expect(await db.auditLog.count({ where: { action: "document.view" } })).toBe(1);
  });
});
