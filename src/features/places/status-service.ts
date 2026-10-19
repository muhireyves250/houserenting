import "server-only";
import { audit } from "@/features/audit/service";
import { checkMove, type ListingMove } from "@/features/listings/lifecycle";
import { notify, notifyAdmins } from "@/features/notifications/service";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

export type Actor = { id: string; role?: string | null };
export type MoveResult = { ok: true } | { ok: false; error: "notFound" | "notAllowed" | "wrongStatus" | "reasonNeeded" | "payoutMissing" | "noPrices" };

const GOES_LIVE: ListingMove[] = ["approve", "publishDirect", "unhide", "resume", "reinstate"];
// Checked payout details are needed the first time a place is published; restoring a place that was live doesn't ask again.
const FIRST_PUBLISH: ListingMove[] = ["approve", "publishDirect"];

/**
 * The one way a listing's status changes. Checks who may do it, asks for a reason where the owner must be told why,
 * and refuses to put an owner's place live before their payout details are verified. Logged and the owner told.
 */
export async function moveListing(actor: Actor, listingId: string, move: ListingMove, reason = "", now: Date = new Date()): Promise<MoveResult> {
  const why = reason.trim().slice(0, 500);
  return db.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({
      where: { id: listingId },
      select: { status: true, hostId: true, title: true, operator: true, publishedAt: true, _count: { select: { rates: true } } },
    });
    if (!listing) return { ok: false, error: "notFound" } as const;
    const check = checkMove(move, listing.status, { isStaff: isAdmin(actor), isOwner: listing.hostId === actor.id }, why);
    if (!check.ok) return check;
    if (GOES_LIVE.includes(move)) {
      if (listing._count.rates === 0) return { ok: false, error: "noPrices" } as const;
      // Owners must be payable before their place takes bookings; places VIIPA runs itself don't need this.
      if (FIRST_PUBLISH.includes(move) && listing.operator === "OWNER") {
        const payout = await tx.payoutAccount.findUnique({ where: { userId: listing.hostId }, select: { verifiedAt: true } });
        if (!payout?.verifiedAt) return { ok: false, error: "payoutMissing" } as const;
      }
    }
    await tx.listing.update({
      where: { id: listingId },
      data: {
        status: check.to,
        rejectionReason: why || (check.to === "PUBLISHED" ? null : undefined),
        ...(check.to === "PUBLISHED" && !listing.publishedAt ? { publishedAt: now } : {}),
      },
    });
    await audit(tx, { actorId: actor.id, action: `listing.${move}`, entityType: "listing", entityId: listingId, data: { from: listing.status, to: check.to, ...(why ? { reason: why } : {}) } });
    if (move === "submit") await notifyAdmins(tx, "listingSubmitted", { title: listing.title }, `/admin/listings/${listingId}`);
    else if (listing.hostId !== actor.id) {
      // Approval and rejection keep their own friendlier notices; other changes say the new status.
      if (move === "approve") await notify(tx, listing.hostId, "listingApproved", { title: listing.title }, `/listings/${listingId}`);
      else if (move === "reject") await notify(tx, listing.hostId, "listingRejected", { title: listing.title, reason: why }, `/host/listings/${listingId}`);
      else await notify(tx, listing.hostId, "listingStatus", { title: listing.title, status: check.to, reason: why }, `/host/listings/${listingId}`);
    }
    return { ok: true } as const;
  });
}

/** Staff-only settings of a place: management agreement, highlight on the home page, who operates it. */
export async function updatePlaceAdmin(
  adminId: string,
  listingId: string,
  input: { contractStart: string | null; contractEnd: string | null; featured: boolean; operator: "OWNER" | "VIIPA"; keepVisible?: boolean },
): Promise<{ ok: boolean; error?: "dates" }> {
  const date = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);
  const start = date(input.contractStart);
  const end = date(input.contractEnd);
  if (start && end && end <= start) return { ok: false, error: "dates" };
  return db.$transaction(async (tx) => {
    const before = await tx.listing.findUnique({ where: { id: listingId }, select: { contractStart: true, contractEnd: true, featured: true, operator: true } });
    if (!before) return { ok: false };
    await tx.listing.update({ where: { id: listingId }, data: { contractStart: start, contractEnd: end, featured: input.featured, operator: input.operator, ...(input.keepVisible === undefined ? {} : { keepVisible: input.keepVisible }) } });
    const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
    await audit(tx, {
      actorId: adminId,
      action: "listing.adminSettings",
      entityType: "listing",
      entityId: listingId,
      data: {
        from: `${iso(before.contractStart) ?? "—"}…${iso(before.contractEnd) ?? "—"} ${before.featured ? "★" : ""} ${before.operator}`,
        to: `${iso(start) ?? "—"}…${iso(end) ?? "—"} ${input.featured ? "★" : ""} ${input.operator}`,
      },
    });
    return { ok: true };
  });
}

/** Places whose management agreement ends within `days` (staff are reminded to start the renewal). */
export function contractsEnding(now: Date = new Date(), days = 30) {
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const limit = new Date(today.getTime() + days * 86_400_000);
  return db.listing.findMany({
    where: { status: { not: "ARCHIVED" }, contractEnd: { gte: today, lte: limit } },
    orderBy: { contractEnd: "asc" },
    select: { id: true, title: true, contractEnd: true, host: { select: { name: true } } },
  });
}

/**
 * Daily: tells staff and the owner when a place's management agreement ends in exactly 30 or 7 days,
 * so each reminder goes out once. Returns how many places were reminded about.
 */
export async function remindContractsEnding(now: Date = new Date()): Promise<number> {
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const days = [30, 7].map((d) => new Date(today.getTime() + d * 86_400_000));
  const ending = await db.listing.findMany({
    where: { status: { not: "ARCHIVED" }, contractEnd: { in: days } },
    select: { id: true, title: true, hostId: true, contractEnd: true },
  });
  for (const listing of ending) {
    const data = { title: listing.title, date: listing.contractEnd!.toISOString().slice(0, 10) };
    await notifyAdmins(db, "contractEnding", data, `/admin/listings/${listing.id}`);
    await notify(db, listing.hostId, "contractEnding", data, `/host/listings/${listing.id}`);
  }
  return ending.length;
}
