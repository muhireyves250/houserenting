import { beforeEach, describe, expect, it } from "vitest";
import { staffMoveBooking } from "@/features/bookings/service";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { attributeBooking, decidePromoterReward, markPromoterRewardPaid, promoterDashboard, recordVisit, savePromoter, setPromoterStatus } from "./service";

const admin = { id: "admin", role: "ADMIN" };
let n = 0;

async function stay(guestId: string, checkIn: string) {
  const reference = `SR-PRM${String(++n).padStart(3, "0")}`;
  await db.booking.create({
    data: {
      reference,
      listingId: "house",
      guestId,
      status: "CHECKED_IN",
      checkIn: new Date(`${checkIn}T00:00:00Z`),
      checkOut: new Date(Date.parse(`${checkIn}T00:00:00Z`) + 86_400_000),
      startAt: new Date(`${checkIn}T12:00:00Z`),
      endAt: new Date(Date.parse(`${checkIn}T09:00:00Z`) + 86_400_000),
      nights: 1,
      guests: 1,
      nightlyPrice: 100_000,
      subtotal: 100_000,
      total: 100_000,
      hostPayout: 90_000,
      policySnapshot: {},
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
      { id: "pro", name: "Promoter", email: "pro@example.com" },
      { id: "guest", name: "Guest", email: "guest@example.com" },
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" },
    ],
  });
  await db.listing.create({
    data: { id: "house", hostId: "host", title: "House", description: "Nice", type: "PRIVATE_HOUSE", status: "PUBLISHED", addressLine: "KG 1", district: "Gasabo", city: "Kigali", lat: -1.95, lng: 30.06, sizeM2: 90, rooms: 3, bedrooms: 2, bathrooms: 1, maxGuests: 4 },
  });
  await db.platformConfig.create({ data: { id: 1, promoterEnabled: true, promoterRewardBps: 500 } });
});

describe("promoters", () => {
  it("rewards an approved promoter once per guest per 30 days for finished stays, never for their own", async () => {
    expect((await savePromoter("pro", { payoutMethod: "MOBILE_MONEY", payoutName: "Pro", payoutNumber: "0788000000" })).ok).toBe(true);
    const p = await db.promoter.findUniqueOrThrow({ where: { userId: "pro" } });
    expect(await recordVisit(p.code, "v1")).toBe(false); // not approved yet
    expect(await setPromoterStatus(admin, p.id, "ACTIVE")).toBe(true);
    expect(await recordVisit(p.code, "v1")).toBe(true);
    expect(await recordVisit(p.code, "v1")).toBe(true);
    expect(await db.promoterVisit.count()).toBe(1);

    const first = await stay("guest", "2026-10-01");
    await attributeBooking(first, "guest", p.code);
    const own = await stay("pro", "2026-10-03");
    await attributeBooking(own, "pro", p.code);
    expect((await db.booking.findUniqueOrThrow({ where: { reference: own } })).promoterId).toBeNull();

    expect(await staffMoveBooking("admin", first, "COMPLETED", new Date("2026-10-02T10:00:00Z"))).toBe(true);
    const reward = await db.promoterReward.findFirstOrThrow();
    expect(reward.amount).toBe(5000);

    const again = await stay("guest", "2026-10-05");
    await attributeBooking(again, "guest", p.code);
    await staffMoveBooking("admin", again, "COMPLETED", new Date("2026-10-06T10:00:00Z"));
    expect(await db.promoterReward.count()).toBe(1);

    expect(await markPromoterRewardPaid(admin, reward.id)).toBe(false); // approve first
    expect(await decidePromoterReward(admin, reward.id, true)).toBe(true);
    expect(await markPromoterRewardPaid(admin, reward.id)).toBe(true);
    expect(await db.ledgerEntry.findFirst({ where: { kind: "PROMOTER_REWARD" } })).toMatchObject({ amount: 5000 });
    expect(await promoterDashboard("pro")).toMatchObject({ visits30: 1, paid: 5000 });
  }, 180_000);
});
