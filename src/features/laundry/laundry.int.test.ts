import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { cancelMyLaundry, claimLaundryPayment, confirmLaundryPayment, confirmLaundryReceived, moveLaundry, placeLaundry, placeLaundryToDo, requestLaundry, stayLaundry } from "./service";

const NOW = new Date("2026-11-11T08:00:00Z");
const admin = { id: "admin", role: "ADMIN" };
const host = { id: "host", role: "USER" };

async function place(id: string, laundryPricePerKg: number | null) {
  await db.listing.create({
    data: {
      id,
      hostId: "host",
      title: `Lodge ${id}`,
      description: "Nice",
      type: "LODGE",
      status: "PUBLISHED",
      addressLine: "KG 1",
      district: "Musanze",
      city: "Musanze",
      lat: -1.5,
      lng: 29.6,
      sizeM2: 80,
      rooms: 3,
      bedrooms: 2,
      bathrooms: 1,
      maxGuests: 4,
      laundryPricePerKg,
    },
  });
}

async function stay(reference: string, listingId: string, checkIn = "2026-11-10", checkOut = "2026-11-14") {
  await db.booking.create({
    data: {
      reference,
      listingId,
      guestId: "guest",
      status: "CHECKED_IN",
      checkIn: new Date(`${checkIn}T00:00:00Z`),
      checkOut: new Date(`${checkOut}T00:00:00Z`),
      startAt: new Date(`${checkIn}T12:00:00Z`),
      endAt: new Date(`${checkOut}T09:00:00Z`),
      unit: "NIGHT",
      quantity: 4,
      nights: 4,
      guests: 2,
      nightlyPrice: 50_000,
      subtotal: 200_000,
      total: 200_000,
      hostPayout: 180_000,
      policySnapshot: {},
    },
  });
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
  await db.platformConfig.create({ data: { id: 1, commissionBps: 1000 } });
  await place("paid", 1500);
  await place("free", 0);
  await place("none", null);
});

describe("laundry during a stay", () => {
  it("guest asks, staff accept, the place's owner collects, weighs (price by kg) and returns, the guest confirms; then pays and the ledger gets commission and the place's share", async () => {
    await stay("SR-LAUND1", "paid");
    expect(await requestLaundry("guest", "SR-LAUND1", "3 shirts", NOW)).toMatchObject({ ok: true });
    expect(await requestLaundry("guest", "SR-LAUND1", "more", NOW)).toEqual({ ok: false, error: "open" });
    const [order] = await stayLaundry((await db.booking.findUniqueOrThrow({ where: { reference: "SR-LAUND1" } })).id);
    const ref = order!.reference;
    expect(await db.notification.count({ where: { userId: "admin", kind: "laundryRequested" } })).toBe(1);

    // Only VIIPA accepts; nobody collects before that.
    expect(await moveLaundry(host, ref, "ACCEPTED")).toEqual({ ok: false, error: "notAllowed" });
    expect(await moveLaundry(host, ref, "PICKED_UP")).toEqual({ ok: false, error: "notFound" });
    expect(await moveLaundry(admin, ref, "ACCEPTED")).toEqual({ ok: true });
    expect(await db.notification.count({ where: { userId: "host", kind: "laundryForHost" } })).toBe(1);
    expect(await placeLaundryToDo("host")).toBe(1);
    expect(await placeLaundry("host")).toHaveLength(1);
    expect(await placeLaundry("someone")).toHaveLength(0);

    // The place's owner does the work; someone else can't.
    expect(await moveLaundry({ id: "someone" }, ref, "PICKED_UP")).toEqual({ ok: false, error: "notAllowed" });
    expect(await moveLaundry(host, ref, "PICKED_UP")).toEqual({ ok: true });
    expect(await moveLaundry(host, ref, "WASHED", { kg: "nope" })).toEqual({ ok: false, error: "weight" });
    expect(await moveLaundry(host, ref, "WASHED", { kg: "2.5" })).toEqual({ ok: true });
    expect(await db.laundryOrder.findUniqueOrThrow({ where: { reference: ref } })).toMatchObject({ weightGrams: 2500, amount: 3750 });
    expect(await moveLaundry(host, ref, "CANCELLED", { reason: "no" })).toEqual({ ok: false, error: "notAllowed" });
    expect(await moveLaundry(host, ref, "RETURNED")).toEqual({ ok: true });
    expect(await db.notification.count({ where: { userId: "admin", kind: "laundryReturned" } })).toBe(1);
    expect(await placeLaundryToDo("host")).toBe(0);

    // Only the guest confirms they got it back; staff and the place are told.
    expect(await confirmLaundryReceived("someone", ref)).toBe(false);
    expect(await confirmLaundryReceived("guest", ref)).toBe(true);
    expect(await confirmLaundryReceived("guest", ref)).toBe(false);
    expect(await db.notification.count({ where: { userId: "admin", kind: "laundryReceived" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: "host", kind: "laundryReceived" } })).toBe(1);

    expect(await claimLaundryPayment("guest", ref, "MP2611.LAUND.001")).toEqual({ ok: true });
    expect(await confirmLaundryPayment(host, ref)).toEqual({ ok: false, error: "notAllowed" });
    expect(await confirmLaundryPayment(admin, ref, undefined, NOW)).toEqual({ ok: true });
    expect(await confirmLaundryPayment(admin, ref, undefined, NOW)).toEqual({ ok: false, error: "notFound" });
    const ledger = await db.ledgerEntry.findMany({ where: { note: `laundry ${ref}` } });
    expect(Object.fromEntries(ledger.map((e) => [e.kind, e.amount]))).toEqual({ GUEST_PAYMENT: 3750, COMMISSION: 375, HOST_PAYABLE: 3375 });
    expect(ledger.find((e) => e.kind === "HOST_PAYABLE")?.hostId).toBe("host");
    // Accepted, collected, washed, returned, paid.
    expect(await db.notification.count({ where: { userId: "guest", kind: "laundryUpdate" } })).toBe(5);
  });

  it("free laundry costs nothing and needs no payment", async () => {
    await stay("SR-LAUND2", "free");
    const req = await requestLaundry("guest", "SR-LAUND2", "", NOW);
    if (!req.ok) throw new Error("request failed");
    await moveLaundry(admin, req.reference, "ACCEPTED");
    await moveLaundry(host, req.reference, "PICKED_UP");
    await moveLaundry(host, req.reference, "WASHED", { kg: "4" });
    expect(await db.laundryOrder.findUniqueOrThrow({ where: { reference: req.reference } })).toMatchObject({ amount: 0 });
    expect(await claimLaundryPayment("guest", req.reference, "MP2611.LAUND.002")).toEqual({ ok: false, error: "notFound" });
    expect(await confirmLaundryPayment(admin, req.reference, "MP2611.LAUND.002")).toEqual({ ok: false, error: "notFound" });
  });

  it("only during a paid stay that has started, at a place that offers laundry; guests can withdraw before pickup", async () => {
    await stay("SR-LAUND3", "none");
    await stay("SR-LAUND4", "paid", "2026-11-20", "2026-11-22");
    await stay("SR-LAUND5", "paid");
    expect(await requestLaundry("guest", "SR-LAUND3", "", NOW)).toEqual({ ok: false, error: "notOffered" });
    expect(await requestLaundry("guest", "SR-LAUND4", "", NOW)).toEqual({ ok: false, error: "noStay" });
    expect(await requestLaundry("someone", "SR-LAUND5", "", NOW)).toEqual({ ok: false, error: "noStay" });
    const req = await requestLaundry("guest", "SR-LAUND5", "", NOW);
    if (!req.ok) throw new Error("request failed");
    expect(await cancelMyLaundry("guest", req.reference)).toBe(true);
    expect(await moveLaundry(admin, req.reference, "ACCEPTED")).toEqual({ ok: false, error: "notFound" });
  });
});
