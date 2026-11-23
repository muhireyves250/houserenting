import { beforeEach, describe, expect, it } from "vitest";
import { reviewListing, setUserRole, unpublishListing } from "@/features/admin/service";
import { getPublishedListing } from "@/features/listings/service";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { validListing } from "./fixtures";
import { addPhoto, archiveListing, getHostListing, hostDashboard, saveListing, submitForReview } from "./service";

const CLOUD = "https://res.cloudinary.com/demo/";

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "host", name: "Host", email: "host@example.com" },
      { id: "other", name: "Other", email: "other@example.com" },
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" },
    ],
  });
  // Owner-run places need checked payout details before they go live.
  await db.payoutAccount.create({ data: { userId: "host", method: "MOBILE_MONEY", accountName: "Host", accountNumber: "0788000000", verifiedAt: new Date() } });
});

async function created() {
  const result = await saveListing("host", null, validListing);
  if (!result.ok) throw new Error("save failed");
  // Photos are required before review; an agreed commission before going live.
  await db.listingPhoto.create({ data: { listingId: result.id, url: "https://res.cloudinary.com/x/1.jpg", publicId: "x/1", width: 800, height: 600, position: 0 } });
  await db.commissionAgreement.create({ data: { subject: "PLACE", subjectId: result.id, percentBps: 1000, effectiveFrom: new Date("2026-01-01T00:00:00Z"), createdById: "admin" } });
  return result.id;
}

describe("hosting a place", () => {
  it("creates a draft that guests can't see, and marks the user as a host", async () => {
    const id = await created();
    expect(await db.listing.findUnique({ where: { id }, select: { status: true } })).toEqual({ status: "DRAFT" });
    expect(await getPublishedListing(id)).toBeNull();
    expect((await db.user.findUnique({ where: { id: "host" } }))?.isHost).toBe(true);
    expect((await getHostListing("host", id))?.rates).toHaveLength(1);
    expect(await getHostListing("other", id)).toBeNull();
  });

  it("returns field errors instead of saving bad input", async () => {
    const result = await saveListing("host", null, { ...validListing, title: "Hi" });
    expect(result).toEqual({ ok: false, errors: { title: expect.any(String) } });
    expect(await db.listing.count()).toBe(0);
  });

  it("goes live only when staff approve it; after that only staff change it", async () => {
    const id = await created();
    expect(await reviewListing("admin", id, { approve: true })).toBe(false); // not submitted yet
    expect(await submitForReview("other", id)).toBe(false);
    expect(await submitForReview("host", id)).toBe(true);
    expect(await db.notification.findMany({ where: { userId: "admin" } })).toEqual([expect.objectContaining({ kind: "listingSubmitted" })]);

    expect(await reviewListing("admin", id, { approve: true })).toBe(true);
    expect(await getPublishedListing(id)).not.toBeNull();
    expect(await db.notification.findFirst({ where: { userId: "host" } })).toMatchObject({ kind: "listingApproved", href: `/listings/${id}` });

    // The owner can't change a live place; VIIPA can, and it stays live.
    expect(await saveListing("host", id, { ...validListing, title: "Sunny studio, now with a view" })).toEqual({ ok: false, error: "locked" });
    expect(await saveListing("host", id, { ...validListing, title: "Sunny studio, now with a view" }, { staffId: "admin" })).toEqual({ ok: true, id });
    expect((await getPublishedListing(id))?.title).toBe("Sunny studio, now with a view");

    const log = await db.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } });
    expect(log.map((l) => [l.action, l.actorId])).toEqual([
      ["listing.create", "host"],
      ["listing.submit", "host"],
      ["listing.approve", "admin"],
      ["listing.update", "admin"],
    ]);
  });

  it("rejection needs a reason the host can read, then the host can resubmit", async () => {
    const id = await created();
    await submitForReview("host", id);
    expect(await reviewListing("admin", id, { approve: false, reason: "  " })).toBe(false);
    expect(await reviewListing("admin", id, { approve: false, reason: "Add photos of the bedroom" })).toBe(true);
    expect(await db.listing.findUnique({ where: { id }, select: { status: true, rejectionReason: true } })).toEqual({
      status: "REJECTED",
      rejectionReason: "Add photos of the bedroom",
    });
    expect(await submitForReview("host", id)).toBe(true);
  });

  it("staff can take a live listing down with a reason", async () => {
    const id = await created();
    await submitForReview("host", id);
    await reviewListing("admin", id, { approve: true });
    expect(await unpublishListing("admin", id, "Reported as unavailable")).toBe(true);
    expect(await getPublishedListing(id)).toBeNull();
  });

  it("accepts photos only from our image host, for the owner", async () => {
    const id = await created();
    await db.listingPhoto.deleteMany({ where: { listingId: id } });
    const photo = { url: `${CLOUD}image/upload/v1/a.jpg`, publicId: "a", width: 1200, height: 800 };
    expect(await addPhoto("other", id, photo, CLOUD)).toBe(false);
    expect(await addPhoto("host", id, { ...photo, url: "https://evil.example/a.jpg" }, CLOUD)).toBe(false);
    expect(await addPhoto("host", id, photo, CLOUD)).toBe(true);
    expect(await addPhoto("host", id, { ...photo, publicId: "b" }, CLOUD)).toBe(true);
    expect((await getHostListing("host", id))?.photos.map((p) => [p.publicId, p.position])).toEqual([["a", 0], ["b", 1]]);
  });

  it("owners can't remove a place; that's VIIPA's job", async () => {
    const id = await created();
    expect(await archiveListing("other", id)).toBe(false);
    expect(await archiveListing("host", id)).toBe(false);
  });
});

describe("roles", () => {
  it("lets an admin grant staff access, never to themselves, and logs it", async () => {
    expect(await setUserRole("admin", "admin", "USER")).toBe(false);
    expect(await setUserRole("admin", "other", "ADMIN")).toBe(true);
    expect(await db.auditLog.findFirst({ where: { entityId: "other" } })).toMatchObject({ action: "user.role", data: { from: "USER", to: "ADMIN" } });
  });
});

describe("owner dashboard", () => {
  it("counts only the owner's own places: staying now, arriving this week, nights this month, earnings per month", async () => {
    const mine = await created();
    const theirs = (await saveListing("other", null, validListing)) as { ok: true; id: string };
    const stay = (ref: string, listingId: string, status: "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED", from: string, to: string, nights: number, hostPayout: number) =>
      db.booking.create({
        data: {
          reference: ref,
          listingId,
          guestId: "other",
          status,
          checkIn: new Date(`${from}T00:00:00Z`),
          checkOut: new Date(`${to}T00:00:00Z`),
          startAt: new Date(`${from}T12:00:00Z`),
          endAt: new Date(`${to}T09:00:00Z`),
          nights,
          guests: 1,
          nightlyPrice: 10000,
          total: nights * 10000,
          hostPayout,
          policySnapshot: {},
        },
      });
    await stay("SR-HAA234", mine, "CHECKED_IN", "2026-11-18", "2026-11-21", 3, 27000); // staying now
    await stay("SR-HAB234", mine, "CONFIRMED", "2026-11-23", "2026-11-25", 2, 18000); // arriving this week
    await stay("SR-HAC234", mine, "CONFIRMED", "2026-12-10", "2026-12-12", 2, 18000); // later
    await stay("SR-HAD234", mine, "COMPLETED", "2026-09-02", "2026-09-04", 2, 20000); // earlier month
    await stay("SR-HAE234", mine, "CANCELLED", "2026-11-19", "2026-11-20", 1, 9000); // never counts
    await stay("SR-HAF234", theirs.id, "CHECKED_IN", "2026-11-18", "2026-11-21", 3, 27000); // someone else's place

    const dash = await hostDashboard("host", new Date("2026-11-20T08:00:00Z"));
    expect(dash.stayingNow).toBe(1);
    expect(dash.arriving).toBe(1);
    expect(dash.nightsThisMonth).toBe(5);
    expect(dash.nightsByPlace.get(mine)).toBe(5);
    expect(dash.nightsByPlace.has(theirs.id)).toBe(false);
    expect(dash.upcomingByPlace.get(mine)).toBe(2);
    expect(dash.months.map((m) => m.month)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(dash.months.find((m) => m.month === "2026-11")?.amount).toBe(45000);
    expect(dash.months.find((m) => m.month === "2026-09")?.amount).toBe(20000);
  });
});

describe("photos are required", () => {
  it("a place without photos can't be sent for review", async () => {
    const result = await saveListing("host", null, validListing);
    if (!result.ok) throw new Error("save failed");
    expect(await submitForReview("host", result.id)).toBe(false);
    await db.listingPhoto.create({ data: { listingId: result.id, url: "https://res.cloudinary.com/x/1.jpg", publicId: "x/1", width: 800, height: 600, position: 0 } });
    expect(await submitForReview("host", result.id)).toBe(true);
  });

  it("only official villages are accepted as the location; the names come from the village", async () => {
    expect(await saveListing("host", null, { ...validListing, villageCode: "RW-V-99999" })).toMatchObject({ ok: false, errors: { villageCode: "location" } });
    const result = await saveListing("host", null, { ...validListing, district: "typed by hand" });
    if (!result.ok) throw new Error("save failed");
    expect(await db.listing.findUniqueOrThrow({ where: { id: result.id } })).toMatchObject({ province: "Kigali City", district: "Gasabo", sector: "Kimihurura", cell: "Kamukina", village: "Inyamibwa", villageCode: "RW-V-00582" });
  });
});
