import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { placeOverview } from "./overview";

const NOW = new Date("2026-11-10T10:00:00Z");

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({ data: [{ id: "host", name: "Host", email: "host@example.com" }, { id: "g1", name: "Ama", email: "g1@example.com" }, { id: "g2", name: "Bo", email: "g2@example.com" }] });
  await db.listing.create({
    data: { id: "gh", hostId: "host", title: "Guest house", description: "x", type: "GUEST_HOUSE", status: "PUBLISHED", bookingModel: "ROOM_BY_ROOM", addressLine: "x", district: "Rubavu", city: "Rubavu", lat: -1.7, lng: 29.3, sizeM2: 200, rooms: 3, bedrooms: 3, bathrooms: 3, maxGuests: 6 },
  });
  await db.room.create({ data: { id: "cat", listingId: "gh", name: "Lake view", maxGuests: 2, numbers: ["1", "2", "3"], rates: { create: [{ unit: "NIGHT", price: 40000 }] } } });
});

const stay = (reference: string, guestId: string, roomNumber: string, startAt: string, endAt: string, status: "CHECKED_IN" | "PENDING_PAYMENT" = "CHECKED_IN") =>
  db.booking.create({
    data: { reference, listingId: "gh", guestId, roomId: "cat", roomNumber, status, checkIn: new Date(startAt.slice(0, 10)), checkOut: new Date(endAt.slice(0, 10)), startAt: new Date(startAt), endAt: new Date(endAt), nights: 1, guests: 1, nightlyPrice: 40000, subtotal: 40000, total: 40000, hostPayout: 36000, policySnapshot: {} },
  });

describe("a place at a glance", () => {
  it("shows each room today, the next booking and the work still open", async () => {
    await stay("SR-GL0001", "g1", "1", "2026-11-09T12:00:00Z", "2026-11-12T09:00:00Z");
    const waiting = await stay("SR-GL0002", "g2", "3", "2026-11-20T12:00:00Z", "2026-11-21T09:00:00Z", "PENDING_PAYMENT");
    await db.payment.create({ data: { bookingId: waiting.id, provider: "manual", providerReference: "MP.TEST.1", amount: 40000, status: "PENDING" } });
    await db.availabilityBlock.create({ data: { listingId: "gh", roomId: null, kind: "MAINTENANCE", reason: "Pipes", startsAt: new Date("2026-12-01T00:00:00Z"), createdById: "host" } }).catch(() => null);

    const o = await placeOverview("gh", NOW);
    expect(o.rooms.map((r) => [r.number, r.state])).toEqual([["1", "occupied"], ["2", "free"], ["3", "free"]]);
    expect(o.rooms[0]).toMatchObject({ guest: "Ama" });
    expect(o.next).toMatchObject({ reference: "SR-GL0002" });
    expect(o.tasks.map((t) => t.key)).toEqual(expect.arrayContaining(["claims", "noAgreement", "payout", "photos"]));
    expect(o.tasks.find((t) => t.key === "claims")?.count).toBe(1);
  });
});
