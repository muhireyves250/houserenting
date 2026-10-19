import "server-only";
import { audit } from "@/features/audit/service";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import type { Actor } from "./status-service";

export const DOCUMENT_KINDS = ["OWNER_ID", "OWNERSHIP_PROOF", "MANAGEMENT_AUTHORIZATION", "OTHER"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_MAX_BYTES = 8 * 1024 * 1024;
export const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

/** Checks the first bytes too, so a renamed file can't pass as a PDF or image. */
export function sniffType(bytes: Uint8Array): (typeof DOCUMENT_TYPES)[number] | null {
  const b = bytes;
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

async function owns(actor: Actor, listingId: string) {
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { hostId: true } });
  return Boolean(listing && (listing.hostId === actor.id || isAdmin(actor)));
}

export type UploadResult = { ok: true; id: string } | { ok: false; error: "notAllowed" | "tooLarge" | "badType" | "invalid" };

export async function uploadDocument(actor: Actor, listingId: string, kind: string, filename: string, bytes: Uint8Array): Promise<UploadResult> {
  if (!DOCUMENT_KINDS.includes(kind as DocumentKind) || !filename) return { ok: false, error: "invalid" };
  if (bytes.byteLength > DOCUMENT_MAX_BYTES) return { ok: false, error: "tooLarge" };
  const mimeType = sniffType(bytes);
  if (!mimeType) return { ok: false, error: "badType" };
  if (!(await owns(actor, listingId))) return { ok: false, error: "notAllowed" };
  const safeName = filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  return db.$transaction(async (tx) => {
    const doc = await tx.listingDocument.create({ data: { listingId, kind: kind as DocumentKind, filename: safeName, mimeType, size: bytes.byteLength, data: Buffer.from(bytes), uploadedById: actor.id } });
    await audit(tx, { actorId: actor.id, action: "document.upload", entityType: "listing", entityId: listingId, data: { document: doc.id, kind } });
    return { ok: true, id: doc.id } as const;
  });
}

/** Document list without the file contents. */
export function listingDocuments(listingId: string) {
  return db.listingDocument.findMany({ where: { listingId }, orderBy: { createdAt: "desc" }, select: { id: true, kind: true, filename: true, mimeType: true, size: true, createdAt: true } });
}

/** A document for its listing's owner or staff only; every staff view is logged. */
export async function readDocument(actor: Actor, documentId: string) {
  const doc = await db.listingDocument.findUnique({ where: { id: documentId }, include: { listing: { select: { hostId: true } } } });
  if (!doc || (doc.listing.hostId !== actor.id && !isAdmin(actor))) return null;
  if (isAdmin(actor)) await audit(db, { actorId: actor.id, action: "document.view", entityType: "listing", entityId: doc.listingId, data: { document: doc.id } });
  return doc;
}

export async function deleteDocument(actor: Actor, documentId: string): Promise<boolean> {
  const doc = await db.listingDocument.findUnique({ where: { id: documentId }, select: { listingId: true, listing: { select: { hostId: true } } } });
  if (!doc || (doc.listing.hostId !== actor.id && !isAdmin(actor))) return false;
  await db.$transaction(async (tx) => {
    await tx.listingDocument.delete({ where: { id: documentId } });
    await audit(tx, { actorId: actor.id, action: "document.delete", entityType: "listing", entityId: doc.listingId, data: { document: documentId } });
  });
  return true;
}
