import { beforeEach, describe, expect, it } from "vitest";
import { reviewListing, setUserRole, unpublishListing } from "@/features/admin/service";
import { getPublishedListing } from "@/features/listings/service";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { validListing } from "./fixtures";
import { addPhoto, archiveListing, getHostListing, saveListing, submitForReview } from "./service";

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

  it("goes live only when staff approve it, and edits send it back to review", async () => {
    const id = await created();
    expect(await reviewListing("admin", id, { approve: true })).toBe(false); // not submitted yet
    expect(await submitForReview("other", id)).toBe(false);
    expect(await submitForReview("host", id)).toBe(true);
    expect(await db.notification.findMany({ where: { userId: "admin" } })).toEqual([expect.objectContaining({ kind: "listingSubmitted" })]);

    expect(await reviewListing("admin", id, { approve: true })).toBe(true);
    expect(await getPublishedListing(id)).not.toBeNull();
    expect(await db.notification.findFirst({ where: { userId: "host" } })).toMatchObject({ kind: "listingApproved", href: `/listings/${id}` });

    expect(await saveListing("host", id, { ...validListing, title: "Sunny studio, now with a view" })).toEqual({ ok: true, id });
    expect(await getPublishedListing(id)).toBeNull();
    expect((await db.listing.findUnique({ where: { id } }))?.status).toBe("PENDING_REVIEW");

    const log = await db.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } });
    expect(log.map((l) => [l.action, l.actorId])).toEqual([
      ["listing.create", "host"],
      ["listing.submit", "host"],
      ["listing.approve", "admin"],
      ["listing.update", "host"],
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
    const photo = { url: `${CLOUD}image/upload/v1/a.jpg`, publicId: "a", width: 1200, height: 800 };
    expect(await addPhoto("other", id, photo, CLOUD)).toBe(false);
    expect(await addPhoto("host", id, { ...photo, url: "https://evil.example/a.jpg" }, CLOUD)).toBe(false);
    expect(await addPhoto("host", id, photo, CLOUD)).toBe(true);
    expect(await addPhoto("host", id, { ...photo, publicId: "b" }, CLOUD)).toBe(true);
    expect((await getHostListing("host", id))?.photos.map((p) => [p.publicId, p.position])).toEqual([["a", 0], ["b", 1]]);
  });

  it("archives only the owner's listing", async () => {
    const id = await created();
    expect(await archiveListing("other", id)).toBe(false);
    expect(await archiveListing("host", id)).toBe(true);
  });
});

describe("roles", () => {
  it("lets an admin grant staff access, never to themselves, and logs it", async () => {
    expect(await setUserRole("admin", "admin", "USER")).toBe(false);
    expect(await setUserRole("admin", "other", "ADMIN")).toBe(true);
    expect(await db.auditLog.findFirst({ where: { entityId: "other" } })).toMatchObject({ action: "user.role", data: { from: "USER", to: "ADMIN" } });
  });
});
