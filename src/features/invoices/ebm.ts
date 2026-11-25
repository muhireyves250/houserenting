import "server-only";
import { audit } from "@/features/audit/service";
import { notify, notifyAdmins } from "@/features/notifications/service";
import { canOn } from "@/features/places/access";
import { DOCUMENT_MAX_BYTES, sniffType } from "@/features/places/documents-service";
import { db } from "@/lib/db";

type Actor = { id: string; role?: string | null; staffAreas?: readonly string[] | null };
export type EbmUploadResult = { ok: true } | { ok: false; error: "notAllowed" | "notFound" | "tooLarge" | "badType" };

/**
 * VIIPA, the place's owner, its managers or receptionists upload the booking's EBM receipt (PDF or photo; a new one
 * replaces the old). The guest is told and can download it from their booking.
 */
export async function uploadEbm(actor: Actor, reference: string, filename: string, bytes: Uint8Array): Promise<EbmUploadResult> {
  const booking = await db.booking.findUnique({ where: { reference }, select: { id: true, listingId: true, guestId: true } });
  if (!booking) return { ok: false, error: "notFound" };
  if (!(await canOn(actor, booking.listingId, "bookings"))) return { ok: false, error: "notAllowed" };
  if (bytes.byteLength > DOCUMENT_MAX_BYTES) return { ok: false, error: "tooLarge" };
  const mimeType = sniffType(bytes);
  if (!mimeType) return { ok: false, error: "badType" };
  const data = { filename: (filename || "ebm").replace(/[^\w.\- ]+/g, "_").slice(0, 120), mimeType, size: bytes.byteLength, data: Buffer.from(bytes), uploadedById: actor.id, createdAt: new Date() };
  await db.$transaction(async (tx) => {
    await tx.ebmReceipt.upsert({ where: { bookingId: booking.id }, create: { bookingId: booking.id, ...data }, update: data });
    await audit(tx, { actorId: actor.id, action: "booking.ebmUpload", entityType: "booking", entityId: reference });
    await notify(tx, booking.guestId, "ebmReady", { reference }, `/bookings/${reference}`);
  });
  return { ok: true };
}

/** The EBM receipt, for the guest of the booking or anyone running the place (VIIPA, owner, managers, receptionists). */
export async function readEbm(actor: Actor, reference: string) {
  const booking = await db.booking.findUnique({ where: { reference }, select: { guestId: true, listingId: true, ebm: true } });
  if (!booking?.ebm) return null;
  if (booking.guestId !== actor.id && !(await canOn(actor, booking.listingId, "bookings"))) return null;
  return booking.ebm;
}

/** Whether a booking has its EBM receipt yet (and when it was uploaded). */
export async function ebmOf(reference: string) {
  return db.ebmReceipt.findFirst({ where: { booking: { reference } }, select: { filename: true, createdAt: true } });
}

/** The guest asks for the EBM receipt when it isn't there yet: VIIPA and the place's team are told. */
export async function askForEbm(guestId: string, reference: string): Promise<boolean> {
  const booking = await db.booking.findFirst({ where: { reference, guestId }, select: { id: true, ebm: { select: { id: true } }, listing: { select: { hostId: true, title: true, team: { where: { role: { in: ["MANAGER", "RECEPTIONIST"] } }, select: { userId: true } } } } } });
  if (!booking || booking.ebm) return false;
  await db.$transaction(async (tx) => {
    await audit(tx, { actorId: guestId, action: "booking.ebmRequest", entityType: "booking", entityId: reference });
    await notifyAdmins(tx, "ebmRequested", { reference }, `/admin/bookings/${reference}`);
    for (const userId of new Set([booking.listing.hostId, ...booking.listing.team.map((m) => m.userId)])) await notify(tx, userId, "ebmRequested", { reference }, "/host/desk");
  });
  return true;
}
