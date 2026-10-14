import "server-only";
import { audit } from "@/features/audit/service";
import { notifyAdmins } from "@/features/notifications/service";
import { db } from "@/lib/db";
import { listingInput, type ListingInput } from "./validation";

export type SaveResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> } | { ok: false; error: "notFound" };

const HOST_LIST_SELECT = {
  id: true,
  title: true,
  type: true,
  status: true,
  city: true,
  district: true,
  rejectionReason: true,
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
export async function saveListing(hostId: string, id: string | null, raw: ListingInput): Promise<SaveResult> {
  const parsed = listingInput.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.join(".") || "form"] ??= issue.message;
    return { ok: false, errors };
  }
  const { rates, ...fields } = parsed.data;

  return db.$transaction(async (tx) => {
    if (id === null) {
      const created = await tx.listing.create({ data: { ...fields, hostId, status: "DRAFT", rates: { create: rates } } });
      await tx.user.update({ where: { id: hostId }, data: { isHost: true } });
      await audit(tx, { actorId: hostId, action: "listing.create", entityType: "listing", entityId: created.id });
      return { ok: true, id: created.id };
    }
    const existing = await tx.listing.findFirst({ where: { id, hostId, status: { not: "ARCHIVED" } }, select: { status: true } });
    if (!existing) return { ok: false, error: "notFound" };
    const status = existing.status === "PUBLISHED" ? "PENDING_REVIEW" : existing.status;
    await tx.rateOption.deleteMany({ where: { listingId: id } });
    await tx.listing.update({ where: { id }, data: { ...fields, status, rates: { create: rates } } });
    await audit(tx, { actorId: hostId, action: "listing.update", entityType: "listing", entityId: id, data: { from: existing.status, to: status } });
    if (existing.status === "PUBLISHED") await notifyAdmins(tx, "listingSubmitted", { title: fields.title }, `/admin/listings/${id}`);
    return { ok: true, id };
  });
}

/** Draft or rejected → waiting for staff review. */
export async function submitForReview(hostId: string, id: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({ where: { id, hostId, status: { in: ["DRAFT", "REJECTED"] } }, select: { title: true, status: true } });
    if (!listing) return false;
    await tx.listing.update({ where: { id }, data: { status: "PENDING_REVIEW", rejectionReason: null } });
    await audit(tx, { actorId: hostId, action: "listing.submit", entityType: "listing", entityId: id, data: { from: listing.status } });
    await notifyAdmins(tx, "listingSubmitted", { title: listing.title }, `/admin/listings/${id}`);
    return true;
  });
}

/** Takes a listing off the site for good (bookings and history stay). */
export async function archiveListing(hostId: string, id: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.listing.updateMany({ where: { id, hostId, status: { not: "ARCHIVED" } }, data: { status: "ARCHIVED" } });
    if (count === 1) await audit(tx, { actorId: hostId, action: "listing.archive", entityType: "listing", entityId: id });
    return count === 1;
  });
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

export async function removePhoto(hostId: string, listingId: string, photoId: string): Promise<boolean> {
  const { count } = await db.listingPhoto.deleteMany({ where: { id: photoId, listingId, listing: { hostId } } });
  return count === 1;
}
