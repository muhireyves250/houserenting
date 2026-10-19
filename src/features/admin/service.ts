import "server-only";
import { audit } from "@/features/audit/service";
import { moveListing } from "@/features/places/status-service";
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
  const result = await moveListing({ id: adminId, role: "ADMIN" }, id, decision.approve ? "approve" : "reject", decision.approve ? "" : decision.reason, now);
  return result.ok;
}

/** Staff take a live listing off the site (hidden) with a reason; they can show it again later. */
export async function unpublishListing(adminId: string, id: string, reason: string): Promise<boolean> {
  return (await moveListing({ id: adminId, role: "ADMIN" }, id, "hide", reason)).ok;
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

/** Whether this staff member may give or remove staff access: super admins, or any admin until a super admin exists. */
export async function canManageStaff(actor: { id: string; role?: string | null }): Promise<boolean> {
  if (actor.role === "SUPER_ADMIN") return true;
  if (actor.role !== "ADMIN") return false;
  return (await db.user.count({ where: { role: "SUPER_ADMIN" } })) === 0;
}

/**
 * Grants or removes staff access (VIIPA admin or super admin). Only those allowed to manage staff may do it,
 * and nobody changes their own role (no accidental lock-out).
 */
export async function setUserRole(adminId: string, userId: string, role: "USER" | "ADMIN" | "SUPER_ADMIN"): Promise<boolean> {
  if (adminId === userId) return false;
  const actor = await db.user.findUnique({ where: { id: adminId }, select: { id: true, role: true } });
  if (!actor || !(await canManageStaff(actor))) return false;
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
