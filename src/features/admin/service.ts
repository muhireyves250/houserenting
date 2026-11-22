import "server-only";
import { audit } from "@/features/audit/service";
import { moveListing } from "@/features/places/status-service";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canStaff, STAFF_AREAS, type AppRole } from "@/lib/roles";

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
export async function setUserRole(adminId: string, userId: string, role: AppRole): Promise<boolean> {
  if (adminId === userId) return false;
  const actor = await db.user.findUnique({ where: { id: adminId }, select: { id: true, role: true } });
  if (!actor || !(await canManageStaff(actor))) return false;
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user || user.role === role) return false;
    // Only managers carry areas: a new manager starts with none until they are ticked; others have none.
    await tx.user.update({ where: { id: userId }, data: { role, ...(role !== "MANAGER" ? { staffAreas: [] } : {}) } });
    await audit(tx, { actorId: adminId, action: "user.role", entityType: "user", entityId: userId, data: { from: user.role, to: role } });
    return true;
  });
}

/**
 * Which services a manager may manage (admins and super admins manage everything). Only those allowed to manage
 * staff may change it, never their own, and only on managers. Unknown areas are dropped.
 */
export async function setStaffAreas(adminId: string, userId: string, raw: readonly unknown[]): Promise<boolean> {
  if (adminId === userId) return false;
  const areas = STAFF_AREAS.filter((area) => raw.includes(area));
  const actor = await db.user.findUnique({ where: { id: adminId }, select: { id: true, role: true } });
  if (!actor || !(await canManageStaff(actor))) return false;
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true, staffAreas: true } });
    if (!user || user.role !== "MANAGER") return false;
    await tx.user.update({ where: { id: userId }, data: { staffAreas: areas } });
    await audit(tx, { actorId: adminId, action: "user.areas", entityType: "user", entityId: userId, data: { from: user.staffAreas, to: areas } });
    return true;
  });
}

/** Account actions (password reset, delete) are for those who manage staff. */
async function mayManage(adminId: string) {
  const actor = await db.user.findUnique({ where: { id: adminId }, select: { id: true, role: true } });
  return Boolean(actor && (await canManageStaff(actor)));
}

export type AccountActionResult = { ok: true } | { ok: false; error: "notAllowed" | "notFound" | "self" | "hasHistory" | "failed" };

/**
 * Sends the person a link to choose a new password (nobody sees or sets their password). Only those who manage staff
 * may do it; logged.
 */
export async function sendPasswordReset(adminId: string, userId: string, redirectTo: string): Promise<AccountActionResult> {
  if (adminId === userId) return { ok: false, error: "self" };
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
  if (!user) return { ok: false, error: "notFound" };
  if (!(await mayManage(adminId))) return { ok: false, error: "notAllowed" };
  try {
    await auth.api.requestPasswordReset({ body: { email: user.email, redirectTo } });
  } catch {
    return { ok: false, error: "failed" };
  }
  await audit(db, { actorId: adminId, action: "user.passwordReset", entityType: "user", entityId: userId });
  return { ok: true };
}

/**
 * Deletes an account that has no history (no bookings, places, food or laundry orders, payouts). Accounts with a
 * history are suspended instead, so records stay whole. Never yourself; only those who manage staff; logged.
 */
export async function deleteUser(adminId: string, userId: string): Promise<AccountActionResult> {
  if (adminId === userId) return { ok: false, error: "self" };
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, _count: { select: { bookings: true, listings: true } } },
  });
  if (!user) return { ok: false, error: "notFound" };
  if (!(await mayManage(adminId))) return { ok: false, error: "notAllowed" };
  const [food, laundry, payouts] = await Promise.all([
    db.foodOrder.count({ where: { customerId: userId } }),
    db.laundryOrder.count({ where: { guestId: userId } }),
    db.settlement.count({ where: { hostId: userId } }),
  ]);
  if (user._count.bookings + user._count.listings + food + laundry + payouts > 0) return { ok: false, error: "hasHistory" };
  try {
    await db.$transaction(async (tx) => {
      await audit(tx, { actorId: adminId, action: "user.delete", entityType: "user", entityId: userId, data: { email: user.email } });
      await tx.user.delete({ where: { id: userId } });
    });
  } catch {
    // Something still points at this account: keep it (suspend it instead).
    return { ok: false, error: "hasHistory" };
  }
  return { ok: true };
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

export type HostAccessResult = { ok: true } | { ok: false; error: "notAllowed" | "notFound" | "hasPlaces" };

/**
 * Staff make someone a place owner (they then land on the owner dashboard instead of booking), or take it away.
 * Not for oneself; not taken from someone who still owns places (archive or move them first). Logged.
 */
export async function setHostAccess(actor: { id: string; role?: string | null; staffAreas?: readonly string[] | null }, userId: string, isHost: boolean): Promise<HostAccessResult> {
  if (actor.id === userId || !canStaff(actor, "settings")) return { ok: false, error: "notAllowed" };
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { isHost: true, _count: { select: { listings: true } } } });
    if (!user) return { ok: false, error: "notFound" } as const;
    if (user.isHost === isHost) return { ok: true } as const;
    if (!isHost && user._count.listings > 0) return { ok: false, error: "hasPlaces" } as const;
    await tx.user.update({ where: { id: userId }, data: { isHost } });
    await audit(tx, { actorId: actor.id, action: isHost ? "user.hostOn" : "user.hostOff", entityType: "user", entityId: userId });
    return { ok: true } as const;
  });
}

export type PickedPerson = { id: string; name: string; email: string; phone: string | null };
export type CreateAccountResult = { ok: true; person: PickedPerson } | { ok: false; error: "notAllowed" | "invalid" | "exists" | "failed" };

/**
 * Staff open an account for someone who has none yet (to make them an owner, manager or restaurant staff). The
 * person gets an email to set their own password; nobody else ever knows it. Logged.
 */
export async function createAccountForPerson(
  actor: { id: string; role?: string | null; staffAreas?: readonly string[] | null },
  raw: { name: string; email: string; phone?: string | null },
  redirectTo: string,
): Promise<CreateAccountResult> {
  if (!["settings", "listings", "food"].some((a) => canStaff(actor, a as "settings"))) return { ok: false, error: "notAllowed" };
  const name = String(raw.name ?? "").trim().slice(0, 100);
  const email = String(raw.email ?? "").trim().toLowerCase();
  const phone = String(raw.phone ?? "").trim().slice(0, 30) || null;
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return { ok: false, error: "invalid" };
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) return { ok: false, error: "exists" };
  const { randomBytes, randomUUID } = await import("node:crypto");
  const { hashPassword } = await import("@/features/auth/password");
  const userId = randomUUID();
  // A long random password no one knows: the person sets their own from the email.
  const password = await hashPassword(randomBytes(32).toString("base64url"));
  const person = await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { id: userId, name, email, phone }, select: { id: true, name: true, email: true, phone: true } });
    await tx.account.create({ data: { id: randomUUID(), accountId: userId, providerId: "credential", userId, password } });
    await audit(tx, { actorId: actor.id, action: "user.createdByStaff", entityType: "user", entityId: userId, data: { email } });
    return user;
  });
  try {
    await auth.api.requestPasswordReset({ body: { email, redirectTo } });
  } catch {
    // The account exists; staff can send the email again from the person's page.
  }
  return { ok: true, person };
}
