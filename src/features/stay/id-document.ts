import "server-only";
import { DOCUMENT_MAX_BYTES, sniffType } from "@/features/places/documents-service";
import { audit } from "@/features/audit/service";
import { db } from "@/lib/db";
import { canOn } from "@/features/places/access";
import { isAdmin } from "@/lib/roles";

type Actor = { id: string; role?: string | null };

/** The guest uploads their ID for a paid, upcoming stay at a place that asks for it online. Replaces an earlier upload. */
export async function uploadGuestId(guestId: string, reference: string, filename: string, bytes: Uint8Array): Promise<{ ok: true } | { ok: false; error: "notFound" | "notAsked" | "tooLarge" | "badType" }> {
  const b = await db.booking.findFirst({ where: { guestId, reference, status: { in: ["CONFIRMED", "CHECKED_IN", "PENDING_PAYMENT"] } }, select: { id: true, listing: { select: { guestIdPolicy: true } } } });
  if (!b) return { ok: false, error: "notFound" };
  if (b.listing.guestIdPolicy !== "UPLOAD_ONLINE") return { ok: false, error: "notAsked" };
  if (bytes.length > DOCUMENT_MAX_BYTES) return { ok: false, error: "tooLarge" };
  const mimeType = sniffType(bytes);
  if (!mimeType) return { ok: false, error: "badType" };
  const name = filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "id";
  const data = { filename: name, mimeType, size: bytes.length, data: Buffer.from(bytes) };
  await db.guestDocument.upsert({ where: { bookingId: b.id }, create: { bookingId: b.id, ...data }, update: { ...data, createdAt: new Date() } });
  await audit(db, { actorId: guestId, action: "booking.guestId", entityType: "booking", entityId: reference });
  return { ok: true };
}

/** For the guest, the place's owner, or staff (staff views are logged). */
export async function readGuestId(actor: Actor, reference: string) {
  const b = await db.booking.findUnique({ where: { reference }, select: { guestId: true, listingId: true, guestDocument: true } });
  if (!b?.guestDocument) return null;
  const allowed = b.guestId === actor.id || (await canOn(actor, b.listingId, "guestId"));
  if (!allowed) return null;
  if (isAdmin(actor)) await audit(db, { actorId: actor.id, action: "booking.guestIdView", entityType: "booking", entityId: reference });
  return b.guestDocument;
}
