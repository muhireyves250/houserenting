import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { readGuestId, uploadGuestId } from "./id-document";
import { decideStayRequest, markNoShow, myStay, requestStayChange, saveStayFeedback, settleRefund, withdrawStayRequest } from "./service";

const NOW = new Date("2026-11-01T08:00:00Z");
const admin = { id: "admin", role: "ADMIN" };
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
let n = 0;

async function booking(over: { status?: "CONFIRMED" | "CHECKED_IN" | "PENDING_PAYMENT"; checkIn?: string; checkOut?: string; listingId?: string } = {}) {
  const checkIn = over.checkIn ?? "2026-11-10";
  const checkOut = over.checkOut ?? "2026-11-15";
  const reference = `SR-TEST${String(++n).padStart(2, "0")}`;
  await db.booking.create({
    data: {
      reference,
      listingId: over.listingId ?? "house",
      guestId: "guest",
      status: over.status ?? "CONFIRMED",
      checkIn: new Date(`${checkIn}T00:00:00Z`),
      checkOut: new Date(`${checkOut}T00:00:00Z`),
      startAt: new Date(`${checkIn}T12:00:00Z`),
      endAt: new Date(`${checkOut}T09:00:00Z`),
      unit: "NIGHT",
      quantity: 5,
      nights: 5,
      guests: 2,
      nightlyPrice: 100_000,
      subtotal: 500_000,
      total: 500_000,
      hostPayout: 450_000,
      policySnapshot: { checkInTime: "14:00", checkOutTime: "11:00", houseRules: [], cancellationPolicy: null },
      holdExpiresAt: over.status === "PENDING_PAYMENT" ? new Date(NOW.getTime() + 3_600_000) : null,
    },
  });
  return reference;
}

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
  await db.listing.create({
    data: {
      id: "house",
      hostId: "host",
      title: "Lake house",
      description: "Nice",
      type: "PRIVATE_HOUSE",
      status: "PUBLISHED",
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
      guestIdPolicy: "UPLOAD_ONLINE",
    },
  });
});

describe("MY STAY", () => {
  it("shows the next paid stay, and nothing when there is none", async () => {
    expect((await myStay("guest", NOW)).current).toBeNull();
    const ref = await booking();
    expect((await myStay("guest", NOW)).current?.reference).toBe(ref);
  });

  it("extends a stay when the dates are free, and says what's left to pay", async () => {
    const ref = await booking();
    expect(await requestStayChange("guest", ref, { kind: "EXTEND", reason: "Loving it", newCheckOut: "2026-11-17" }, NOW)).toEqual({ ok: true });
    expect(await requestStayChange("guest", ref, { kind: "EXTEND", reason: "Again", newCheckOut: "2026-11-18" }, NOW)).toEqual({ ok: false, error: "pending" });
    const request = await db.stayRequest.findFirstOrThrow();
    expect(await decideStayRequest({ id: "guest" }, request.id, { approve: true, response: "" }, NOW)).toEqual({ ok: false, error: "notAllowed" });
    expect(await decideStayRequest(admin, request.id, { approve: true, response: "Enjoy!" }, NOW)).toEqual({ ok: true });
    const after = await db.booking.findUniqueOrThrow({ where: { reference: ref } });
    expect(after.checkOut.toISOString().slice(0, 10)).toBe("2026-11-17");
    expect(after.nights).toBe(7);
    expect((await db.stayRequest.findUniqueOrThrow({ where: { id: request.id } })).priceChange).toBe(200_000);
  });

  it("won't extend into someone else's booking", async () => {
    const mine = await booking();
    // Another guest's stay right after.
    await db.user.create({ data: { id: "g2", name: "Other", email: "g2@example.com" } });
    const other = await booking({ checkIn: "2026-11-15", checkOut: "2026-11-20" });
    await db.booking.update({ where: { reference: other }, data: { guestId: "g2" } });
    await requestStayChange("guest", mine, { kind: "EXTEND", reason: "More time", newCheckOut: "2026-11-17" }, NOW);
    const request = await db.stayRequest.findFirstOrThrow();
    expect(await decideStayRequest(admin, request.id, { approve: true, response: "" }, NOW)).toEqual({ ok: false, error: "datesTaken" });
  });

  it("cancels a paid stay with a refund that staff then send", async () => {
    const ref = await booking();
    await requestStayChange("guest", ref, { kind: "CANCEL", reason: "Plans changed" }, NOW);
    const request = await db.stayRequest.findFirstOrThrow();
    expect(await decideStayRequest(admin, request.id, { approve: false, response: "" }, NOW)).toEqual({ ok: false, error: "invalid" }); // declining needs a reason
    expect(await decideStayRequest(admin, request.id, { approve: true, response: "", refundAmount: 400_000 }, NOW)).toEqual({ ok: true });
    expect(await db.booking.findUniqueOrThrow({ where: { reference: ref } })).toMatchObject({ status: "CANCELLED", refundStatus: "PENDING", refundAmount: 400_000 });
    expect(await settleRefund("admin", ref, "REFUNDED", "MTN TX 123")).toBe(true);
    expect(await settleRefund("admin", ref, "REFUNDED")).toBe(false);
    expect(await db.ledgerEntry.findFirst({ where: { kind: "REFUND" } })).toMatchObject({ amount: 400_000 });
    expect(await db.notification.findFirst({ where: { userId: "guest", kind: "refundSent" } })).not.toBeNull();
  });

  it("lets the guest withdraw a waiting request, and transfers record where to", async () => {
    const ref = await booking();
    await requestStayChange("guest", ref, { kind: "TRANSFER", reason: "Closer to work", transferTo: "Rusizi" }, NOW);
    const request = await db.stayRequest.findFirstOrThrow();
    expect(request.transferTo).toBe("Rusizi");
    expect(await withdrawStayRequest("other", request.id)).toBe(false);
    expect(await withdrawStayRequest("guest", request.id)).toBe(true);
  });

  it("marks no-shows only after the check-in day", async () => {
    const ref = await booking({ checkIn: "2026-11-01", checkOut: "2026-11-03" });
    expect(await markNoShow("admin", ref, NOW)).toBe(false);
    expect(await markNoShow("admin", ref, new Date("2026-11-02T08:00:00Z"))).toBe(true);
    expect((await db.booking.findUniqueOrThrow({ where: { reference: ref } })).status).toBe("NO_SHOW");
  });
});

describe("feedback and guest ID", () => {
  it("hides a place after enough dislikes, unless staff keep it visible", async () => {
    await db.platformConfig.create({ data: { id: 1, dislikeHideCount: 2 } });
    const a = await booking({ status: "CHECKED_IN", checkIn: "2026-10-25", checkOut: "2026-10-28" });
    expect(await saveStayFeedback("guest", a, false, "Dirty", NOW)).toEqual({ ok: true });
    const b = await booking({ status: "CHECKED_IN", checkIn: "2026-10-31", checkOut: "2026-11-03" });
    expect(await saveStayFeedback("guest", b, false, "", NOW)).toEqual({ ok: true, hidden: true });
    expect((await db.listing.findUniqueOrThrow({ where: { id: "house" } })).status).toBe("HIDDEN");

    await db.listing.update({ where: { id: "house" }, data: { status: "PUBLISHED", keepVisible: true } });
    expect(await saveStayFeedback("guest", a, false, "Still dirty", NOW)).toEqual({ ok: true });
    expect((await db.listing.findUniqueOrThrow({ where: { id: "house" } })).status).toBe("PUBLISHED");
  });

  it("feedback waits until the stay has started", async () => {
    const ref = await booking();
    expect(await saveStayFeedback("guest", ref, true, "", NOW)).toEqual({ ok: false });
  });

  it("keeps the guest's ID private to the guest, the owner and staff", async () => {
    const ref = await booking();
    expect(await uploadGuestId("guest", ref, "id.pdf", new TextEncoder().encode("hello"))).toEqual({ ok: false, error: "badType" });
    expect(await uploadGuestId("guest", ref, "id.pdf", PDF)).toEqual({ ok: true });
    expect(await readGuestId({ id: "stranger" }, ref)).toBeNull();
    expect((await readGuestId({ id: "host" }, ref))?.filename).toBe("id.pdf");
    expect((await readGuestId(admin, ref))?.mimeType).toBe("application/pdf");
  });
});
