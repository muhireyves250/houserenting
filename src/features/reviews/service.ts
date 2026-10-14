import "server-only";
import { audit } from "@/features/audit/service";
import { notify, notifyAdmins } from "@/features/notifications/service";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type ReviewResult = { ok: true } | { ok: false; error: "invalid" | "notAllowed" };

/** Feedback is only for the guest of a stay that has finished, once per booking. */
export async function canReview(userId: string, reference: string): Promise<boolean> {
  const booking = await db.booking.findFirst({ where: { reference, guestId: userId, status: "COMPLETED", review: null }, select: { id: true } });
  return booking !== null;
}

export async function submitReview(userId: string, reference: string, rating: number, text: string): Promise<ReviewResult> {
  const comment = text.trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 10 || comment.length > 2000) return { ok: false, error: "invalid" };
  const booking = await db.booking.findFirst({
    where: { reference, guestId: userId, status: "COMPLETED", review: null },
    select: { id: true, listingId: true, listing: { select: { title: true } } },
  });
  if (!booking) return { ok: false, error: "notAllowed" };
  try {
    await db.$transaction(async (tx) => {
      await tx.review.create({ data: { bookingId: booking.id, listingId: booking.listingId, authorId: userId, rating, comment } });
      await notifyAdmins(tx, "reviewSubmitted", { title: booking.listing.title }, "/admin/moderation");
    });
  } catch (error) {
    // A second submit for the same booking (double click) hits the one-review-per-booking rule.
    if ((error as { code?: string }).code === "P2002") return { ok: false, error: "notAllowed" };
    throw error;
  }
  return { ok: true };
}

/** Rating on the listing = average of published feedback only. */
async function refreshRating(tx: Prisma.TransactionClient, listingId: string) {
  const { _avg, _count } = await tx.review.aggregate({ where: { listingId, status: "PUBLISHED" }, _avg: { rating: true }, _count: true });
  await tx.listing.update({ where: { id: listingId }, data: { ratingAvg: _avg.rating ?? 0, ratingCount: _count } });
}

export async function moderateReview(adminId: string, reviewId: string, publish: boolean): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const review = await tx.review.findFirst({ where: { id: reviewId, status: "PENDING" }, select: { listingId: true, authorId: true, listing: { select: { title: true } } } });
    if (!review) return false;
    await tx.review.update({ where: { id: reviewId }, data: { status: publish ? "PUBLISHED" : "REJECTED" } });
    if (publish) {
      await refreshRating(tx, review.listingId);
      await notify(tx, review.authorId, "reviewPublished", { title: review.listing.title }, `/listings/${review.listingId}#reviews`);
    }
    await audit(tx, { actorId: adminId, action: publish ? "review.publish" : "review.reject", entityType: "review", entityId: reviewId });
    return true;
  });
}

export function publishedReviews(listingId: string) {
  return db.review.findMany({
    where: { listingId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, rating: true, comment: true, createdAt: true, author: { select: { name: true } } },
  });
}

export function pendingReviews() {
  return db.review.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true, rating: true, comment: true, createdAt: true, author: { select: { name: true } }, listing: { select: { id: true, title: true } } },
  });
}
