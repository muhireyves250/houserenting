"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uploadedImagePrefix, uploadTicket, type UploadTicket } from "@/lib/cloudinary";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/session";
import { addPhoto, archiveListing, getHostListing, removePhoto, saveListing, submitForReview, type SaveResult } from "./service";
import type { ListingInput } from "./validation";

const id = z.string().min(1).max(64);

function refresh(listingId?: string) {
  revalidatePath("/[locale]/host", "layout");
  if (listingId) revalidatePath(`/[locale]/listings/${listingId}`, "page");
}

export async function saveListingAction(listingId: string | null, input: ListingInput): Promise<SaveResult | { ok: false; error: "auth" | "failed" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (listingId !== null && !id.safeParse(listingId).success) return { ok: false, error: "notFound" };
  try {
    const result = await saveListing(user.id, listingId, input);
    if (result.ok) refresh(result.id);
    return result;
  } catch (err) {
    logger.error({ err, listingId }, "save listing failed");
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
  if (!user || !id.safeParse(listingId).success || !(await getHostListing(user.id, listingId))) return null;
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
  const ok = await addPhoto(user.id, listingId, parsed.data, prefix);
  if (ok) refresh(listingId);
  return { ok };
}

export async function removePhotoAction(listingId: string, photoId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(listingId).success || !id.safeParse(photoId).success) return { ok: false };
  const ok = await removePhoto(user.id, listingId, photoId);
  if (ok) refresh(listingId);
  return { ok };
}
