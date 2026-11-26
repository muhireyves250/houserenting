import { beforeEach, describe, expect, it } from "vitest";
import { checkPromo, setPromoShare } from "@/features/promotions/service";
import { staffMoveBooking } from "@/features/bookings/service";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { approvePromoter, attributeBooking, endExpiredPromoters, givePromoCode, decidePromoterReward, deletePromoter, markPromoterRewardPaid, promoterDashboard, recordVisit, savePromoter, setPromoterStatus, staffAddPromoter, staffEditPromoter } from "./service";

const admin = { id: "admin", role: "ADMIN" };
/** A period that covers the whole test (codes and promoters need start and end dates). */
const PERIOD = { startsOn: "2026-01-01", endsOn: "2027-12-31" };
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

describe("staff manage promoters", () => {
  const payout = { about: "Campus", payoutMethod: "MOBILE_MONEY" as const, payoutName: "Pro Moter", payoutNumber: "0788123456", bankName: null };

  it("add someone with an account (active at once), edit them, and delete one without rewards", async () => {
    const code = { code: "pro5", percentOff: 5, sharePercent: 4, ...PERIOD };
    expect(await staffAddPromoter({ id: "pro" }, "pro@example.com", payout, code)).toEqual({ ok: false, error: "notAllowed" });
    expect(await staffAddPromoter(admin, "nobody@example.com", payout, code)).toEqual({ ok: false, error: "noAccount" });
    // Every new promoter needs their promo code.
    expect(await staffAddPromoter(admin, "PRO@example.com", payout, { code: "x", percentOff: 0, sharePercent: 0, ...PERIOD })).toMatchObject({ ok: false, errors: { code: expect.any(String) } });
    expect(await staffAddPromoter(admin, "PRO@example.com", payout, code)).toEqual({ ok: true });
    expect(await staffAddPromoter(admin, "pro@example.com", payout, { ...code, code: "PRO6" })).toEqual({ ok: false, error: "already" });
    const p = await db.promoter.findUniqueOrThrow({ where: { userId: "pro" } });
    expect(p.status).toBe("ACTIVE");
    expect(await db.promoCode.findUniqueOrThrow({ where: { code: "PRO5" } })).toMatchObject({ promoterId: p.id, promoterBps: 400, percentOff: 5, fundedBy: "HOST" });
    expect(await staffEditPromoter(admin, p.id, { ...payout, about: "Markets in Huye" })).toEqual({ ok: true });
    expect((await db.promoter.findUniqueOrThrow({ where: { id: p.id } })).about).toBe("Markets in Huye");
    expect(await deletePromoter(admin, p.id)).toEqual({ ok: true });
    expect(await db.promoter.count({ where: { id: p.id } })).toBe(0);
  });

  it("a promo code given to a promoter credits bookings that use it (no QR visit needed), and shows on their page", async () => {
    // Adding the promoter gives them their code (PRO10); its share is set further down.
    expect(await staffAddPromoter(admin, "pro@example.com", { payoutMethod: "MOBILE_MONEY", payoutName: "Pro", payoutNumber: "0788000000" }, { code: "PRO10", percentOff: 10, sharePercent: 1, ...PERIOD })).toEqual({ ok: true });
    const p = await db.promoter.findUniqueOrThrow({ where: { userId: "pro" } });
    const promo = await db.promoCode.findUniqueOrThrow({ where: { code: "PRO10" } });
    await db.promoCode.update({ where: { id: promo.id }, data: { promoterBps: null } });
    const ref = await stay("guest", "2026-10-10");
    await db.booking.update({ where: { reference: ref }, data: { promoCodeId: promo.id } });
    await attributeBooking(ref, "guest", undefined);
    expect((await db.booking.findUniqueOrThrow({ where: { reference: ref } })).promoterId).toBe(p.id);
    expect((await promoterDashboard("pro"))?.promoCodes.map((c) => c.code)).toEqual(["PRO10"]);
    // The booking was already paid: setting the code's share (10%) rewards it now; the programme's 5% doesn't apply.
    expect(await setPromoShare("admin", promo.id, 10)).toBe(true);
    expect((await db.promoterReward.findFirstOrThrow({ where: { promoterId: p.id } })).amount).toBe(10_000);
    // Finishing the stay doesn't add a second reward.
    expect(await staffMoveBooking("admin", ref, "COMPLETED", new Date("2026-10-11T10:00:00Z"))).toBe(true);
    expect(await db.promoterReward.count({ where: { promoterId: p.id } })).toBe(1);
  });
});

describe("promoter applications", () => {
  it("a client asks to be a promoter; staff approve them with their promo code", async () => {
    expect((await savePromoter("pro", { about: "Campus", payoutMethod: "MOBILE_MONEY", payoutName: "Pro", payoutNumber: "0788000000" })).ok).toBe(true);
    const p = await db.promoter.findUniqueOrThrow({ where: { userId: "pro" } });
    expect(p.status).toBe("PENDING");
    expect(await approvePromoter({ id: "pro" }, p.id, { code: "CAMPUS", percentOff: 10, sharePercent: 5, ...PERIOD })).toEqual({ ok: false, error: "notAllowed" });
    expect(await approvePromoter(admin, p.id, { code: "CAMPUS", percentOff: 10, sharePercent: 5, ...PERIOD })).toEqual({ ok: true });
    expect((await db.promoter.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("ACTIVE");
    expect(await db.promoCode.findUniqueOrThrow({ where: { code: "CAMPUS" } })).toMatchObject({ promoterId: p.id, promoterBps: 500, percentOff: 10 });
    // A code already used elsewhere is refused before anything changes.
    expect(await approvePromoter(admin, p.id, { code: "campus", percentOff: 10, sharePercent: 5, ...PERIOD })).toEqual({ ok: false, errors: { code: "taken" } });
  });
});

describe("promoter period", () => {
  it("ends the promoter after their last day: codes stop, they are told, and they can apply again", async () => {
    expect((await savePromoter("pro", { about: "Campus", payoutMethod: "MOBILE_MONEY", payoutName: "Pro", payoutNumber: "0788000000" })).ok).toBe(true);
    const p = await db.promoter.findUniqueOrThrow({ where: { userId: "pro" } });
    // Dates are needed, the end can't be before the start or already past.
    expect(await approvePromoter(admin, p.id, { code: "CAMPUS", percentOff: 10, sharePercent: 5, startsOn: "2026-12-01", endsOn: "2026-11-30" })).toMatchObject({ ok: false, errors: { endsOn: "endBeforeStart" } });
    expect(await approvePromoter(admin, p.id, { code: "CAMPUS", percentOff: 10, sharePercent: 5, startsOn: "2020-01-01", endsOn: "2020-02-01" })).toMatchObject({ ok: false, errors: { endsOn: "past" } });
    expect(await approvePromoter(admin, p.id, { code: "CAMPUS", percentOff: 10, sharePercent: 5, startsOn: "2026-11-01", endsOn: "2099-12-31" })).toEqual({ ok: true });
    const end = new Date("2099-12-31T23:59:59.999+02:00");
    expect((await db.promoter.findUniqueOrThrow({ where: { id: p.id } })).endsAt).toEqual(end);
    // Another code can't run past the promoter's own end.
    expect(await givePromoCode(admin, p.id, { code: "MORE", percentOff: 5, sharePercent: 2, startsOn: "2026-11-01", endsOn: "2100-06-01" })).toMatchObject({ ok: false, errors: { endsOn: "afterPromoter" } });

    const before = new Date("2099-12-31T20:00:00+02:00");
    const after = new Date("2100-01-01T00:00:01+02:00");
    expect(await checkPromo(db, "campus", 100_000, before)).toMatchObject({ ok: true });
    // Their end passed but nobody has looked yet: the code is already refused.
    expect(await checkPromo(db, "campus", 100_000, after)).toMatchObject({ ok: false });
    expect(await endExpiredPromoters(before)).toBe(0);
    expect(await endExpiredPromoters(after)).toBe(1);
    expect((await db.promoter.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("ENDED");
    expect((await db.promoCode.findUniqueOrThrow({ where: { code: "CAMPUS" } })).active).toBe(false);
    expect(await db.notification.count({ where: { userId: "pro", kind: "promoterStatus" } })).toBeGreaterThan(0);

    // Applying again puts them back in the queue, with no period until VIIPA approves.
    expect((await savePromoter("pro", { about: "Markets", payoutMethod: "MOBILE_MONEY", payoutName: "Pro", payoutNumber: "0788000000" })).ok).toBe(true);
    expect(await db.promoter.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ status: "PENDING", endsAt: null, about: "Markets" });
  });
});
