import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/features/audit/service";
import { notifyAdmins } from "@/features/notifications/service";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { roomInput, ROOM_STATUSES, type RoomInput, type RoomStatus } from "./validation";

type Actor = { id: string; role?: string | null };

/** The listing, if the actor may manage it (its host, or staff). */
async function managed(tx: Prisma.TransactionClient, actor: Actor, listingId: string) {
  const listing = await tx.listing.findFirst({
    where: { id: listingId, status: { not: "ARCHIVED" } },
    select: { id: true, hostId: true, status: true, title: true },
  });
  if (!listing || (listing.hostId !== actor.id && !isAdmin(actor))) return null;
  return listing;
}

export function listingRooms(listingId: string) {
  return db.room.findMany({ where: { listingId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
}

export type SaveRoomResult = { ok: true; id: string } | { ok: false; errors?: Record<string, string> };

/**
 * Adds or edits a room. Like listing edits, changes to a live place go back to staff review; day-to-day status
 * changes (cleaning, repairs) don't.
 */
export async function saveRoom(actor: Actor, listingId: string, roomId: string | null, raw: RoomInput): Promise<SaveRoomResult> {
  const parsed = roomInput.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.join(".") || "form"] ??= issue.message;
    return { ok: false, errors };
  }
  return db.$transaction(async (tx) => {
    const listing = await managed(tx, actor, listingId);
    if (!listing) return { ok: false };
    let id = roomId;
    if (roomId === null) {
      const count = await tx.room.count({ where: { listingId } });
      id = (await tx.room.create({ data: { ...parsed.data, listingId, position: count } })).id;
    } else {
      const { count } = await tx.room.updateMany({ where: { id: roomId, listingId }, data: parsed.data });
      if (count !== 1) return { ok: false };
    }
    await audit(tx, { actorId: actor.id, action: roomId ? "room.update" : "room.create", entityType: "listing", entityId: listingId, data: { room: parsed.data.name } });
    if (listing.status === "PUBLISHED") {
      await tx.listing.update({ where: { id: listingId }, data: { status: "PENDING_REVIEW" } });
      await notifyAdmins(tx, "listingSubmitted", { title: listing.title }, `/admin/listings/${listingId}`);
    }
    return { ok: true, id: id! };
  });
}

/** Reception / owner: mark a room available, under repair, not offered, or being cleaned. Logged. */
export async function setRoomStatus(actor: Actor, roomId: string, status: RoomStatus): Promise<boolean> {
  if (!ROOM_STATUSES.includes(status)) return false;
  return db.$transaction(async (tx) => {
    const room = await tx.room.findUnique({ where: { id: roomId }, select: { listingId: true, status: true, name: true } });
    if (!room || !(await managed(tx, actor, room.listingId)) || room.status === status) return false;
    await tx.room.update({ where: { id: roomId }, data: { status } });
    await audit(tx, { actorId: actor.id, action: "room.status", entityType: "listing", entityId: room.listingId, data: { room: room.name, from: room.status, to: status } });
    return true;
  });
}

/** Deletes a room that was never booked; a room with booking history is taken out of use instead. */
export async function removeRoom(actor: Actor, roomId: string): Promise<"deleted" | "disabled" | false> {
  return db.$transaction(async (tx) => {
    const room = await tx.room.findUnique({ where: { id: roomId }, select: { listingId: true, name: true, _count: { select: { bookings: true } } } });
    if (!room || !(await managed(tx, actor, room.listingId))) return false;
    if (room._count.bookings > 0) {
      await tx.room.update({ where: { id: roomId }, data: { status: "UNAVAILABLE" } });
      await audit(tx, { actorId: actor.id, action: "room.status", entityType: "listing", entityId: room.listingId, data: { room: room.name, to: "UNAVAILABLE" } });
      return "disabled";
    }
    await tx.room.delete({ where: { id: roomId } });
    await audit(tx, { actorId: actor.id, action: "room.delete", entityType: "listing", entityId: room.listingId, data: { room: room.name } });
    return "deleted";
  });
}
