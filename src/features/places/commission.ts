import "server-only";
import { audit } from "@/features/audit/service";
import { feesFor } from "@/features/bookings/money";
import { getSettings } from "@/features/settings/service";
import { db } from "@/lib/db";
import { canStaff } from "@/lib/roles";

type Actor = { id: string; role?: string | null; staffAreas?: readonly string[] | null };

/** Most VIIPA may take from a place (in %). */
export const MAX_COMMISSION_PERCENT = 50;

/**
 * Sets VIIPA's commission on one place, as a percentage (e.g. 8 or 7.5); null goes back to the category's rate.
 * New bookings use it; bookings already made keep the split they were made with. Staff handling money; logged.
 */
export async function setPlaceCommission(actor: Actor, listingId: string, percent: number | null): Promise<boolean> {
  if (!canStaff(actor, "money")) return false;
  if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > MAX_COMMISSION_PERCENT)) return false;
  const bps = percent === null ? null : Math.round(percent * 100);
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { commissionBps: true } });
  if (!listing) return false;
  await db.$transaction(async (tx) => {
    await tx.listing.update({ where: { id: listingId }, data: { commissionBps: bps } });
    await audit(tx, { actorId: actor.id, action: "listing.commission", entityType: "listing", entityId: listingId, data: { from: listing.commissionBps, to: bps } });
  });
  return true;
}

/** Each owner's places with the commission VIIPA takes on each (its own rate, or the category's). */
export async function placeCommissions(hostIds: string[]) {
  const [settings, places] = await Promise.all([
    getSettings(),
    db.listing.findMany({ where: { hostId: { in: hostIds }, status: { not: "ARCHIVED" } }, orderBy: { title: "asc" }, select: { id: true, title: true, type: true, hostId: true, commissionBps: true } }),
  ]);
  return places.map((p) => ({
    ...p,
    /** In effect now (own rate or the category's), in %. */
    percent: (feesFor(settings, p.type, p.commissionBps).commissionBps ?? 0) / 100,
    /** The category's rate, in %, shown when the place has no rate of its own. */
    defaultPercent: (feesFor(settings, p.type).commissionBps ?? 0) / 100,
    own: p.commissionBps !== null,
  }));
}
