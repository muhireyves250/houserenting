import "server-only";
import { audit } from "@/features/audit/service";
import { sniffType } from "@/features/places/documents-service";
import { db } from "@/lib/db";

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

/** Saves a profile photo (JPG, PNG or WEBP up to 2 MB) and points the account's image at it. */
export async function saveProfilePhoto(userId: string, bytes: Uint8Array, now: Date = new Date()): Promise<{ ok: true; image: string } | { ok: false; error: "tooLarge" | "badType" }> {
  if (bytes.length > PHOTO_MAX_BYTES) return { ok: false, error: "tooLarge" };
  const type = sniffType(bytes);
  if (!type || type === "application/pdf") return { ok: false, error: "badType" };
  const image = `/api/v1/avatars/${userId}?v=${now.getTime().toString(36)}`;
  await db.$transaction(async (tx) => {
    await tx.userPhoto.upsert({ where: { userId }, create: { userId, mimeType: type, data: Buffer.from(bytes) }, update: { mimeType: type, data: Buffer.from(bytes) } });
    await tx.user.update({ where: { id: userId }, data: { image } });
    await audit(tx, { actorId: userId, action: "user.photo", entityType: "user", entityId: userId });
  });
  return { ok: true, image };
}

export async function removeProfilePhoto(userId: string): Promise<void> {
  await db.$transaction([db.userPhoto.deleteMany({ where: { userId } }), db.user.update({ where: { id: userId }, data: { image: null } })]);
}

export function profilePhoto(userId: string) {
  return db.userPhoto.findUnique({ where: { userId } });
}
