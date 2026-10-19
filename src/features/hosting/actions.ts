"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uploadedImagePrefix, uploadTicket, type UploadTicket } from "@/lib/cloudinary";
import { logger } from "@/lib/logger";
import { db } from "@/lib/db";
import { canOn } from "@/features/places/access";
import { isAdmin } from "@/lib/roles";
import type { SessionUser } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";
import { addPhoto, archiveListing, getHostListing, removePhoto, saveListing, submitForReview, type SaveResult } from "./service";
import type { ListingInput } from "./validation";

const id = z.string().min(1).max(64);

function refresh(listingId?: string) {
  revalidatePath("/[locale]/host", "layout");
  revalidatePath("/[locale]/admin/listings", "layout");
  if (listingId) revalidatePath(`/[locale]/listings/${listingId}`, "page");
}

export async function saveListingAction(listingId: string | null, input: ListingInput): Promise<SaveResult | { ok: false; error: "auth" | "failed" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (listingId !== null && !id.safeParse(listingId).success) return { ok: false, error: "notFound" };
  try {
    const result = await saveListing(listingId === null ? user.id : await ownerFor(user, listingId), listingId, input, undefined, user.id);
    if (result.ok) refresh(result.id);
    return result;
  } catch (err) {
    logger.error({ err, listingId }, "save listing failed");
    return { ok: false, error: "failed" };
  }
}

/**
 * Whose listing this is, for edits by someone allowed to edit it (the owner, a manager of the place, or staff).
 * Anyone else gets their own id, which then matches nothing.
 */
async function ownerFor(user: SessionUser, listingId: string): Promise<string> {
  if (!(await canOn(user, listingId, "edit"))) return user.id;
  return (await db.listing.findUnique({ where: { id: listingId }, select: { hostId: true } }))?.hostId ?? user.id;
}

/**
 * Staff create a place for an owner (found by id) or for VIIPA to operate (owned by the staff account),
 * or edit any place without sending it back to review.
 */
export async function adminSaveListingAction(
  listingId: string | null,
  input: ListingInput,
  ownerId: string | null,
): Promise<SaveResult | { ok: false; error: "auth" | "failed" }> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return { ok: false, error: "auth" };
  if (listingId !== null && !id.safeParse(listingId).success) return { ok: false, error: "notFound" };
  try {
    const hostId =
      listingId === null
        ? (ownerId && (await db.user.findUnique({ where: { id: ownerId }, select: { id: true } }))?.id) || user.id
        : (await db.listing.findUnique({ where: { id: listingId }, select: { hostId: true } }))?.hostId;
    if (!hostId) return { ok: false, error: "notFound" };
    const result = await saveListing(hostId, listingId, input, { staffId: user.id, operator: ownerId ? "OWNER" : "VIIPA" });
    if (result.ok) refresh(result.id);
    return result;
  } catch (err) {
    logger.error({ err, listingId }, "staff save listing failed");
    return { ok: false, error: "failed" };
  }
}

export async function submitListingAction(listingId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(listingId).success) return { ok: false };
  const ok = await submitForReview(user.id, listingId);
  if (ok) refresh(listingId);
  return { ok };
}

export async function archiveListingAction(listingId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(listingId).success) return { ok: false };
  const ok = await archiveListing(user.id, listingId);
  if (ok) refresh(listingId);
  return { ok };
}

/** Permission to upload one photo for the host's own listing; null when uploads aren't set up. */
export async function photoUploadAction(listingId: string): Promise<UploadTicket | null> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(listingId).success || !(await getHostListing(await ownerFor(user, listingId), listingId))) return null;
  return uploadTicket(`listings/${listingId}`);
}

const photo = z.object({
  url: z.url().max(500),
  publicId: z.string().min(1).max(200),
  width: z.number().int().min(1).max(20_000),
  height: z.number().int().min(1).max(20_000),
});

export async function addPhotoAction(listingId: string, raw: unknown): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const prefix = uploadedImagePrefix();
  const parsed = photo.safeParse(raw);
  if (!user || !prefix || !parsed.success || !id.safeParse(listingId).success) return { ok: false };
  const ok = await addPhoto(await ownerFor(user, listingId), listingId, parsed.data, prefix);
  if (ok) refresh(listingId);
  return { ok };
}

export async function removePhotoAction(listingId: string, photoId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(listingId).success || !id.safeParse(photoId).success) return { ok: false };
  const ok = await removePhoto(await ownerFor(user, listingId), listingId, photoId);
  if (ok) refresh(listingId);
  return { ok };
}
