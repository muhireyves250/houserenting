import { beforeEach, describe, expect, it } from "vitest";
import { createBooking, createMonthlyBooking, staffMoveBooking } from "@/features/bookings/service";
import { ownerBalances, recordSettlement } from "@/features/ledger/service";
import { createPromo } from "@/features/promotions/service";
import { claimReferral, decideReward, ensureReferralCode } from "@/features/referrals/service";
import { updateSettings } from "@/features/settings/service";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { handlePaymentCallback, type CallbackBody } from "./service";

const NOW = new Date("2026-10-15T08:00:00Z");
const pay = { method: "mtn" as const, phone: "0788123456" };
const noPolicy = { en: null, fr: null, rw: null };
const settings = (over: Record<string, unknown> = {}) =>
  updateSettings("admin", { commissionPercent: 10, guestFeePercent: null, holdMinutes: null, monthlyDepositPercent: null, cancellationPolicy: noPolicy, ...over });

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
      rates: { create: [{ unit: "NIGHT", price: 50000 }, { unit: "MONTH", price: 600000, minUnits: 3, maxUnits: 12 }] },
    },
  });
});

async function book(guestId = "g1", over: Record<string, unknown> = {}, now = NOW) {
  const r = await createBooking({ guestId, listingId: "flat", checkIn: "2026-11-01", checkOut: "2026-11-03", guests: 1, payment: pay, ...over }, now);
  if (!r.ok) throw new Error(r.error);
  return db.booking.findUniqueOrThrow({ where: { reference: r.reference } });
}

const paid = (reference: string, amount: number, over: Partial<CallbackBody> = {}): CallbackBody => ({
  eventId: `evt-${reference}-${amount}`,
  provider: "test",
  type: "payment.succeeded",
  bookingReference: reference,
  amount,
  currency: "RWF",
  providerReference: `tx-${reference}`,
  ...over,
});

describe("payment callbacks", () => {
  it("confirm the booking once, write the ledger, and ignore a retried callback", async () => {
    await settings();
    const b = await book();
    expect(await handlePaymentCallback(paid(b.reference, b.total))).toBe("confirmed");
    expect(await handlePaymentCallback(paid(b.reference, b.total))).toBe("duplicate");
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CONFIRMED");
    expect(await db.payment.count({ where: { bookingId: b.id } })).toBe(1);
    const ledger = await db.ledgerEntry.findMany({ where: { bookingId: b.id } });
    expect(Object.fromEntries(ledger.map((e) => [e.kind, e.amount]))).toEqual({ GUEST_PAYMENT: 100000, HOST_PAYABLE: 90000, COMMISSION: 10000 });
    expect(await db.notification.findFirst({ where: { userId: "host", kind: "newBooking" } })).not.toBeNull();
  });

  it("don't confirm when the amount is wrong, and record failures without confirming", async () => {
    const b = await book();
    expect(await handlePaymentCallback(paid(b.reference, 1, { eventId: "e1", providerReference: "tx-1" }))).toBe("amountMismatch");
    expect(await handlePaymentCallback(paid(b.reference, b.total, { eventId: "e2", type: "payment.failed", providerReference: "tx-2" }))).toBe("failedRecorded");
    expect((await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("PENDING_PAYMENT");
    expect(await handlePaymentCallback(paid("SR-ZZZZZZ", 5, { eventId: "e3", providerReference: "tx-3" }))).toBe("unknownBooking");
  });

  it("a late payment confirms a lapsed hold only if the dates are still free", async () => {
    const late = new Date(NOW.getTime() + 2 * 60 * 60 * 1000);
    const first = await book("g1");
    const taken = await book("g2", {}, late); // first's hold lapsed; g2 took the dates
    expect(await handlePaymentCallback(paid(first.reference, first.total))).toBe("datesTaken");
    expect((await db.booking.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("EXPIRED");
    expect(await handlePaymentCallback(paid(taken.reference, taken.total))).toBe("confirmed");
  });
});

describe("owner balances and payouts", () => {
  it("count finished stays as due, never pay out more than that, and log the payout", async () => {
    await settings();
    const b = await book();
    await handlePaymentCallback(paid(b.reference, b.total));
    expect((await ownerBalances())[0]).toMatchObject({ hostId: "host", earned: 0, upcoming: 90000, due: 0 });
    expect(await recordSettlement("admin", { hostId: "host", amount: 1000, method: "MTN MoMo", externalReference: "" })).toEqual({ ok: false, error: "tooMuch" });
    await staffMoveBooking("admin", b.reference, "CHECKED_IN", new Date("2026-11-01T12:00:00Z"));
    await staffMoveBooking("admin", b.reference, "COMPLETED", new Date("2026-11-03T09:00:00Z"));
    expect((await ownerBalances())[0]).toMatchObject({ earned: 90000, upcoming: 0, due: 90000 });
    const paidOut = await recordSettlement("admin", { hostId: "host", amount: 90000, method: "MTN MoMo", externalReference: "MP123" });
    expect(paidOut.ok).toBe(true);
    expect((await ownerBalances())[0]).toMatchObject({ paidOut: 90000, due: 0 });
    expect(await recordSettlement("admin", { hostId: "host", amount: 1, method: "MTN MoMo", externalReference: "" })).toEqual({ ok: false, error: "tooMuch" });
  });
});

describe("promo codes", () => {
  it("discount the stay, count uses, and stop at the limit", async () => {
    expect(await createPromo("admin", { code: " welcome ", percentOff: 10, amountOff: null, minSubtotal: null, startsAt: null, endsAt: null, maxUses: 1, fundedBy: "PLATFORM" })).toEqual({ ok: true });
    const b = await book("g1", { promoCode: "WELCOME" });
    expect(b).toMatchObject({ subtotal: 100000, discount: 10000, total: 90000, hostPayout: 100000 });
    expect(await createBooking({ guestId: "g2", listingId: "flat", checkIn: "2026-11-05", checkOut: "2026-11-06", guests: 1, payment: pay, promoCode: "welcome" }, NOW)).toEqual({
      ok: false,
      error: "promo",
    });
    expect(await createBooking({ guestId: "g2", listingId: "flat", checkIn: "2026-11-05", checkOut: "2026-11-06", guests: 1, payment: pay, promoCode: "NOPE" }, NOW)).toEqual({
      ok: false,
      error: "promo",
    });
  });
});

describe("monthly rentals", () => {
  const monthly = (over: Record<string, unknown> = {}) =>
    createMonthlyBooking({ guestId: "g1", listingId: "flat", start: "2026-12-01", months: 6, payment: pay, ...over }, NOW);

  it("let the client choose the months and pay for all of them when staff set no upfront limit", async () => {
    const r = await monthly({ months: 4 });
    expect(r.ok).toBe(true);
    expect(await db.booking.findFirstOrThrow({ where: { rentalMode: "MONTHLY" } })).toMatchObject({ months: 4, upfrontMonths: 4, subtotal: 2400000 });
  });

  it("are not offered for lodges (paid by the night)", async () => {
    await db.listing.update({ where: { id: "flat" }, data: { type: "LODGE" } });
    expect(await monthly()).toEqual({ ok: false, error: "notOffered" });
  });

  it("hold the whole period, charge the upfront months plus any deposit, and follow the month limits", async () => {
    await settings({ commissionPercent: null, monthlyDepositPercent: 100, monthlyUpfrontMonths: 1 });
    expect(await monthly({ months: 2 })).toEqual({ ok: false, error: "stayLength" });
    const r = await monthly();
    expect(r.ok).toBe(true);
    const b = await db.booking.findFirstOrThrow({ where: { rentalMode: "MONTHLY" } });
    expect(b).toMatchObject({ months: 6, upfrontMonths: 1, subtotal: 600000, deposit: 600000, total: 1200000 });
    expect(b.checkOut.toISOString().slice(0, 10)).toBe("2027-06-01");
    // Nights inside the rental can't be booked.
    expect(await createBooking({ guestId: "g2", listingId: "flat", checkIn: "2027-01-10", checkOut: "2027-01-12", guests: 1, payment: pay }, NOW)).toEqual({ ok: false, error: "unavailable" });
  });
});

describe("identity details for monthly rentals", () => {
  it("asks for exactly what staff chose and keeps it apart from the booking", async () => {
    await settings({ commissionPercent: null, monthlyUpfrontMonths: 1, monthlyIdentity: "ID_NATIONALITY" });
    const base = { guestId: "g1", listingId: "flat", start: "2026-12-01", months: 6, payment: pay };
    expect(await createMonthlyBooking({ ...base, identity: { idNumber: "1199", nationality: null } }, NOW)).toEqual({ ok: false, error: "identity" });
    const r = await createMonthlyBooking({ ...base, identity: { idNumber: "1199080012345678", nationality: "Rwandan" } }, NOW);
    expect(r.ok).toBe(true);
    const b = await db.booking.findFirstOrThrow({ include: { identity: true } });
    expect(b.identity).toMatchObject({ idNumber: "1199080012345678", nationality: "Rwandan" });
  });

  it("stores nothing when no details are required", async () => {
    await settings({ commissionPercent: null, monthlyUpfrontMonths: 1 });
    await createMonthlyBooking({ guestId: "g1", listingId: "flat", start: "2026-12-01", months: 6, payment: pay, identity: { idNumber: "999999", nationality: "X" } }, NOW);
    expect(await db.bookingIdentity.count()).toBe(0);
  });
});

describe("referrals", () => {
  it("credit an inviter once, never self, and reward only after the friend's first finished stay when enabled", async () => {
    const code = await ensureReferralCode("g1");
    expect(await ensureReferralCode("g1")).toBe(code);
    expect(await claimReferral("g1", code)).toBe(false); // self
    expect(await claimReferral("g2", code)).toBe(true);
    expect(await claimReferral("g2", code)).toBe(false); // once

    await settings({ referralEnabled: true, referralRewardAmount: 5000 });
    const b = await book("g2");
    await handlePaymentCallback(paid(b.reference, b.total));
    expect(await db.referralReward.count()).toBe(0);
    await staffMoveBooking("admin", b.reference, "CHECKED_IN", new Date("2026-11-01T12:00:00Z"));
    await staffMoveBooking("admin", b.reference, "COMPLETED", new Date("2026-11-03T09:00:00Z"));
    const reward = await db.referralReward.findFirstOrThrow();
    expect(reward).toMatchObject({ referrerId: "g1", refereeId: "g2", amount: 5000, status: "PENDING" });
    expect(await decideReward("admin", reward.id, true)).toBe(true);
    expect(await db.ledgerEntry.findFirst({ where: { kind: "REFERRAL_REWARD" } })).toMatchObject({ amount: 5000 });
  });
});
