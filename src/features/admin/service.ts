import "server-only";
import { audit } from "@/features/audit/service";
import { notify } from "@/features/notifications/service";
import { db } from "@/lib/db";

export function pendingListings() {
  return db.listing.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      title: true,
      type: true,
      city: true,
      district: true,
      updatedAt: true,
      host: { select: { name: true, email: true } },
      photos: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
    },
  });
}

/** Any listing with its host, for the staff review page. */
export function listingForReview(id: string) {
  return db.listing.findUnique({
    where: { id },
    include: { rates: true, photos: { orderBy: { position: "asc" } }, host: { select: { id: true, name: true, email: true, phone: true } } },
  });
}

export type ReviewDecision = { approve: true } | { approve: false; reason: string };

/** Staff publish a listing waiting for review, or send it back with a reason the host sees. */
export async function reviewListing(adminId: string, id: string, decision: ReviewDecision, now: Date = new Date()): Promise<boolean> {
  const reason = decision.approve ? null : decision.reason.trim().slice(0, 500);
  if (!decision.approve && !reason) return false;
  return db.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({ where: { id, status: "PENDING_REVIEW" }, select: { hostId: true, title: true, publishedAt: true } });
    if (!listing) return false;
    await tx.listing.update({
      where: { id },
      data: decision.approve
        ? { status: "PUBLISHED", rejectionReason: null, publishedAt: listing.publishedAt ?? now }
        : { status: "REJECTED", rejectionReason: reason },
    });
    await audit(tx, {
      actorId: adminId,
      action: decision.approve ? "listing.approve" : "listing.reject",
      entityType: "listing",
      entityId: id,
      data: reason ? { reason } : undefined,
    });
    await notify(
      tx,
      listing.hostId,
      decision.approve ? "listingApproved" : "listingRejected",
      reason ? { title: listing.title, reason } : { title: listing.title },
      decision.approve ? `/listings/${id}` : `/host/listings/${id}`,
    );
    return true;
  });
}

/** Staff can take a published listing down (e.g. after a complaint); the host can fix it and resubmit. */
export async function unpublishListing(adminId: string, id: string, reason: string): Promise<boolean> {
  const why = reason.trim().slice(0, 500);
  if (!why) return false;
  return db.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({ where: { id, status: "PUBLISHED" }, select: { hostId: true, title: true } });
    if (!listing) return false;
    await tx.listing.update({ where: { id }, data: { status: "REJECTED", rejectionReason: why } });
    await audit(tx, { actorId: adminId, action: "listing.unpublish", entityType: "listing", entityId: id, data: { reason: why } });
    await notify(tx, listing.hostId, "listingRejected", { title: listing.title, reason: why }, `/host/listings/${id}`);
    return true;
  });
}

export function findUsers(query: string) {
  const q = query.trim();
  return db.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, name: true, email: true, role: true, isHost: true, status: true, createdAt: true },
  });
}

/** Grants or removes staff access. Admins can't change their own role (no accidental lock-out). */
export async function setUserRole(adminId: string, userId: string, role: "USER" | "ADMIN"): Promise<boolean> {
  if (adminId === userId) return false;
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || user.role === role) return false;
    await tx.user.update({ where: { id: userId }, data: { role } });
    await audit(tx, { actorId: adminId, action: "user.role", entityType: "user", entityId: userId, data: { from: user.role, to: role } });
    return true;
  });
}

export async function dashboardCounts() {
  const [listings, questions, reviews, tickets] = await Promise.all([
    db.listing.count({ where: { status: "PENDING_REVIEW" } }),
    db.listingQuestion.count({ where: { status: "PENDING" } }),
    db.review.count({ where: { status: "PENDING" } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);
  return { listings, questions, reviews, tickets };
}
