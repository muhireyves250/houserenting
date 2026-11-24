import "server-only";
import { pathOfVillage } from "@/features/locations/rwanda";
import { OWNER_EDITABLE } from "@/features/listings/lifecycle";
import { audit } from "@/features/audit/service";
import { notify, notifyAdmins } from "@/features/notifications/service";
import { Prisma } from "@/generated/prisma/client";
import { moveListing } from "@/features/places/status-service";
import { db } from "@/lib/db";
import { todayISO } from "@/features/search/date-range";
import { listingInput, type ListingInput } from "./validation";

export type SaveResult = { ok: true; id: string; pending?: boolean } | { ok: false; errors: Record<string, string> } | { ok: false; error: "notFound" | "locked" };

/** Live places: the owner's edits wait for VIIPA's approval (the place stays live as it was meanwhile). */
const LIVE: readonly string[] = ["PUBLISHED", "PAUSED"];

const HOST_LIST_SELECT = {
  id: true,
  title: true,
  type: true,
  status: true,
  city: true,
  district: true,
  rejectionReason: true,
  commissionBps: true,
  updatedAt: true,
  photos: { select: { url: true }, orderBy: { position: "asc" as const }, take: 1 },
};

export function hostListings(hostId: string) {
  return db.listing.findMany({ where: { hostId, status: { not: "ARCHIVED" } }, select: HOST_LIST_SELECT, orderBy: { updatedAt: "desc" } });
}

/** One of the host's own listings, with everything the edit form needs; null for anyone else's. */
export function getHostListing(hostId: string, id: string) {
  return db.listing.findFirst({
    where: { id, hostId },
    include: { rates: true, photos: { orderBy: { position: "asc" } } },
  });
}

export type HostListing = NonNullable<Awaited<ReturnType<typeof getHostListing>>>;

/**
 * Creates or updates a host's listing. Changes never publish by themselves: a published listing that is edited
 * goes back to review, so staff see every change before guests do.
 */
export async function saveListing(
  hostId: string,
  id: string | null,
  raw: ListingInput,
  /** Staff saving for an owner (or for VIIPA): edits keep the current status, nothing goes back to review. */
  staff?: { staffId: string; operator?: "OWNER" | "VIIPA" },
  /** Who is saving, when not the owner (a manager of the place); recorded in the audit log. */
  editorId?: string,
): Promise<SaveResult> {
  const parsed = listingInput.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.join(".") || "form"] ??= issue.message;
    return { ok: false, errors };
  }
  const { rates, availableFrom, availableUntil, ...rest } = parsed.data;
  // Only official locations: the names come from the village chosen, never from what was typed.
  const place = pathOfVillage(rest.villageCode);
  if (!place) return { ok: false, errors: { villageCode: "location" } };
  const asDate = (v: string | null) => (v ? new Date(`${v}T00:00:00Z`) : null);
  const fields = { ...rest, ...place, availableFrom: asDate(availableFrom), availableUntil: asDate(availableUntil) };

  return db.$transaction(async (tx) => {
    if (id === null) {
      // Never a day already past: empty means from the day it is published.
      const today = asDate(todayISO())!;
      const from = fields.availableFrom && fields.availableFrom > today ? fields.availableFrom : null;
      const created = await tx.listing.create({
        data: { ...fields, availableFrom: from, hostId, status: "DRAFT", operator: staff?.operator ?? "OWNER", rates: { create: rates } },
      });
      await tx.user.update({ where: { id: hostId }, data: { isHost: true } });
      await audit(tx, { actorId: staff?.staffId ?? hostId, action: "listing.create", entityType: "listing", entityId: created.id, data: staff ? { forHost: hostId } : undefined });
      return { ok: true, id: created.id };
    }
    const existing = await tx.listing.findFirst({ where: { id, hostId, status: { not: "ARCHIVED" } }, select: { status: true } });
    if (!existing) return { ok: false, error: "notFound" };
    // A live place: the owner's changes are kept aside for VIIPA to approve; the place stays as it is until then.
    if (!staff && LIVE.includes(existing.status)) {
      await tx.listing.update({ where: { id }, data: { pendingChanges: parsed.data as Prisma.InputJsonValue, pendingChangesAt: new Date() } });
      await audit(tx, { actorId: editorId ?? hostId, action: "listing.changesSubmitted", entityType: "listing", entityId: id });
      await notifyAdmins(tx, "listingChangesSubmitted", { title: fields.title }, `/admin/listings/${id}`);
      return { ok: true, id, pending: true };
    }
    // Hidden or suspended by VIIPA: only VIIPA changes it. Before it's live (draft, in review, sent back) the owner edits freely.
    if (!staff && !OWNER_EDITABLE.includes(existing.status) && existing.status !== "PENDING_REVIEW") return { ok: false, error: "locked" };
    const status = existing.status;
    await tx.rateOption.deleteMany({ where: { listingId: id } });
    await tx.listing.update({ where: { id }, data: { ...fields, status, rates: { create: rates } } });
    await audit(tx, { actorId: staff?.staffId ?? editorId ?? hostId, action: "listing.update", entityType: "listing", entityId: id, data: { from: existing.status, to: status } });
    return { ok: true, id };
  });
}

/** Draft, rejected or sent back → waiting for staff review. */
export async function submitForReview(hostId: string, id: string): Promise<boolean> {
  return (await moveListing({ id: hostId }, id, "submit")).ok;
}

/** Takes a listing off the site for good (bookings and history stay). */
export async function archiveListing(hostId: string, id: string): Promise<boolean> {
  return (await moveListing({ id: hostId }, id, "archive")).ok;
}

const MAX_PHOTOS = 20;

/** Adds an uploaded photo (only from our Cloudinary account) at the end. */
export async function addPhoto(
  hostId: string,
  listingId: string,
  photo: { url: string; publicId: string; width: number; height: number },
  allowedPrefix: string,
): Promise<boolean> {
  if (!photo.url.startsWith(allowedPrefix) || photo.width < 1 || photo.height < 1) return false;
  return db.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({ where: { id: listingId, hostId }, select: { photos: { select: { position: true } } } });
    if (!listing || listing.photos.length >= MAX_PHOTOS) return false;
    const position = Math.max(-1, ...listing.photos.map((p) => p.position)) + 1;
    await tx.listingPhoto.create({ data: { listingId, position, ...photo } });
    return true;
  });
}

export const PHOTO_KINDS = ["GENERAL", "ROOM", "BATHROOM", "KITCHEN", "LIVING_ROOM", "EXTERIOR", "FACILITY"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/** Says what a photo shows (room, bathroom, kitchen, living room, outside, other facilities). */
export async function setPhotoKind(hostId: string, listingId: string, photoId: string, kind: PhotoKind): Promise<boolean> {
  if (!PHOTO_KINDS.includes(kind)) return false;
  const { count } = await db.listingPhoto.updateMany({ where: { id: photoId, listingId, listing: { hostId } }, data: { kind } });
  return count === 1;
}

/** Moves a photo one place earlier or later (the first photo is the cover). */
export async function movePhoto(hostId: string, listingId: string, photoId: string, by: -1 | 1): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const photos = await tx.listingPhoto.findMany({ where: { listingId, listing: { hostId } }, orderBy: { position: "asc" }, select: { id: true, position: true } });
    const i = photos.findIndex((p) => p.id === photoId);
    const j = i + by;
    if (i < 0 || j < 0 || j >= photos.length) return false;
    const a = photos[i]!;
    const b = photos[j]!;
    // Swap positions through a free slot (positions are unique per place).
    await tx.listingPhoto.update({ where: { id: a.id }, data: { position: -1 - a.position } });
    await tx.listingPhoto.update({ where: { id: b.id }, data: { position: a.position } });
    await tx.listingPhoto.update({ where: { id: a.id }, data: { position: b.position } });
    return true;
  });
}

export async function removePhoto(hostId: string, listingId: string, photoId: string): Promise<boolean> {
  const { count } = await db.listingPhoto.deleteMany({ where: { id: photoId, listingId, listing: { hostId } } });
  return count === 1;
}

const STAYING = ["CONFIRMED", "CHECKED_IN", "COMPLETED"] as const;
const DAY_MS = 86_400_000;
/** A Kigali calendar day (UTC+2) as YYYY-MM-DD. */
const kigaliDay = (at: Date) => new Date(at.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);

/**
 * The owner's dashboard numbers, for their own places only (no guest details: guests deal with VIIPA):
 * who is staying now, who arrives this week, nights booked this month per place, and earnings per month.
 */
export async function hostDashboard(hostId: string, now: Date = new Date()) {
  const today = kigaliDay(now);
  const day = (d: string) => new Date(`${d}T00:00:00Z`);
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = new Date(day(monthStart));
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const sixMonthsAgo = new Date(day(monthStart));
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 5);
  const inAWeek = new Date(day(today).getTime() + 7 * DAY_MS);

  const mine = { listing: { hostId }, status: { in: [...STAYING] } };
  const [stayingNow, arriving, thisMonth, upcoming, history] = await Promise.all([
    db.booking.count({ where: { listing: { hostId }, OR: [{ status: "CHECKED_IN" }, { status: "CONFIRMED", checkIn: { lte: day(today) }, checkOut: { gt: day(today) } }] } }),
    db.booking.count({ where: { listing: { hostId }, status: "CONFIRMED", checkIn: { gt: day(today), lte: inAWeek } } }),
    db.booking.groupBy({ by: ["listingId"], where: { ...mine, checkIn: { gte: day(monthStart), lt: nextMonth } }, _sum: { nights: true } }),
    db.booking.groupBy({ by: ["listingId"], where: { listing: { hostId }, status: "CONFIRMED", checkIn: { gte: day(today) } }, _count: true }),
    db.booking.findMany({ where: { ...mine, checkIn: { gte: sixMonthsAgo, lt: nextMonth } }, select: { checkIn: true, hostPayout: true } }),
  ]);

  // Earnings per month of stay, the last six months (every month present, even empty ones).
  const months: { month: string; amount: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const m = new Date(sixMonthsAgo);
    m.setUTCMonth(m.getUTCMonth() + i);
    months.push({ month: m.toISOString().slice(0, 7), amount: 0 });
  }
  for (const b of history) {
    const row = months.find((m) => m.month === b.checkIn.toISOString().slice(0, 7));
    if (row) row.amount += b.hostPayout;
  }

  return {
    stayingNow,
    arriving,
    nightsThisMonth: thisMonth.reduce((sum, r) => sum + (r._sum.nights ?? 0), 0),
    nightsByPlace: new Map(thisMonth.map((r) => [r.listingId, r._sum.nights ?? 0])),
    upcomingByPlace: new Map(upcoming.map((r) => [r.listingId, r._count])),
    months,
  };
}

/**
 * VIIPA answers an owner's changes to a live place: approve (they are saved and shown to guests) or decline with a
 * reason (they are dropped; the place stays as it was). The owner is told either way.
 */
export async function decideListingChanges(staffId: string, listingId: string, approve: boolean, reason = ""): Promise<boolean> {
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { hostId: true, title: true, pendingChanges: true } });
  if (!listing?.pendingChanges) return false;
  const why = reason.trim().slice(0, 300);
  if (!approve && !why) return false;
  if (approve) {
    const saved = await saveListing(listing.hostId, listingId, listing.pendingChanges as unknown as ListingInput, { staffId });
    if (!saved.ok) return false;
  }
  await db.$transaction(async (tx) => {
    await tx.listing.update({ where: { id: listingId }, data: { pendingChanges: Prisma.DbNull, pendingChangesAt: null } });
    await audit(tx, { actorId: staffId, action: approve ? "listing.changesApproved" : "listing.changesDeclined", entityType: "listing", entityId: listingId, ...(why ? { data: { reason: why } } : {}) });
    await notify(tx, listing.hostId, approve ? "listingChangesApproved" : "listingChangesDeclined", { title: listing.title, reason: why }, `/host/listings/${listingId}`);
  });
  return true;
}
