"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/features/audit/service";
import { restaurantRole, canRestaurant, canAddRestaurant } from "@/features/food/service";
import { uploadedImagePrefix, uploadTicket, type UploadTicket } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/** Permission to upload a profile photo to Cloudinary (null when Cloudinary isn't set up: the photo is kept in the database instead). */
export async function profilePhotoTicketAction(): Promise<UploadTicket | null> {
  const user = await getCurrentUser();
  return user ? uploadTicket(`avatars/${user.id}`) : null;
}

/** Saves the uploaded photo's Cloudinary URL on the account (only URLs from our own Cloudinary folder). */
export async function saveProfilePhotoUrlAction(url: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  const prefix = uploadedImagePrefix();
  if (!user || !prefix || typeof url !== "string" || url.length > 500 || !url.startsWith(prefix) || !url.includes(`/avatars/${user.id}/`)) return { ok: false };
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { image: url } }),
    db.userPhoto.deleteMany({ where: { userId: user.id } }),
  ]);
  await audit(db, { actorId: user.id, action: "user.photo", entityType: "user", entityId: user.id });
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

/** Permission to upload a restaurant photo: for its team (edit), or an owner creating one. */
export async function restaurantPhotoTicketAction(restaurantId: string | null): Promise<UploadTicket | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const allowed = restaurantId ? canRestaurant(await restaurantRole(user, restaurantId), "edit") : await canAddRestaurant(user);
  return allowed ? uploadTicket("restaurants") : null;
}
