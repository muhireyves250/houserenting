import "server-only";
import { audit } from "@/features/audit/service";
import { notify } from "@/features/notifications/service";
import { canOn } from "@/features/places/access";
import { db } from "@/lib/db";

export type CleaningResult = { ok: true } | { ok: false; error: "notFound" | "waiting" | "invalid" };

/**
 * A guest staying asks for their room to be cleaned (with an optional note: a time, what's needed). One at a time:
 * a new one once the last is done. The place's owner, managers and receptionists are told.
 */
export async function requestCleaning(guestId: string, reference: string, note = "", now: Date = new Date()): Promise<CleaningResult> {
  if (typeof note !== "string" || note.length > 300) return { ok: false, error: "invalid" };
  const booking = await db.booking.findFirst({
    where: { reference, guestId, status: { in: ["CONFIRMED", "CHECKED_IN"] }, startAt: { lte: now }, endAt: { gt: now } },
    select: { id: true, listingId: true, roomNumber: true, room: { select: { name: true } }, guest: { select: { name: true } }, listing: { select: { hostId: true, title: true, team: { where: { role: { in: ["MANAGER", "RECEPTIONIST"] } }, select: { userId: true } } } } },
  });
  if (!booking) return { ok: false, error: "notFound" };
  if (await db.cleaningRequest.findFirst({ where: { bookingId: booking.id, doneAt: null }, select: { id: true } })) return { ok: false, error: "waiting" };
  await db.$transaction(async (tx) => {
    await tx.cleaningRequest.create({ data: { bookingId: booking.id, listingId: booking.listingId, note: note.trim() || null } });
    await audit(tx, { actorId: guestId, action: "stay.cleaningRequest", entityType: "booking", entityId: reference });
    const where = [booking.listing.title, booking.room?.name, booking.roomNumber].filter(Boolean).join(" · ");
    for (const userId of new Set([booking.listing.hostId, ...booking.listing.team.map((m) => m.userId)])) {
      await notify(tx, userId, "cleaningRequested", { name: booking.guest.name, where }, "/host/desk");
    }
  });
  return { ok: true };
}

/** The guest's cleaning request still waiting, if any (to show "asked at …"). */
export function waitingCleaning(bookingId: string) {
  return db.cleaningRequest.findFirst({ where: { bookingId, doneAt: null }, select: { createdAt: true, note: true } });
}

/** Cleaning asked at these places and not done yet, oldest first, with the guest and the room. */
export function cleaningToDo(listingIds: string[]) {
  return db.cleaningRequest.findMany({
    where: { listingId: { in: listingIds }, doneAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, note: true, createdAt: true, booking: { select: { reference: true, roomNumber: true, room: { select: { name: true } }, guest: { select: { name: true, phone: true } }, listing: { select: { title: true } } } } },
  });
}

/** Someone at the place (receptionist, manager, owner) or VIIPA staff marks a cleaning done; the guest is told. */
export async function markCleaningDone(actor: { id: string; role?: string | null; staffAreas?: readonly string[] | null }, id: string, now: Date = new Date()): Promise<boolean> {
  const req = await db.cleaningRequest.findUnique({ where: { id }, select: { listingId: true, doneAt: true, booking: { select: { reference: true, guestId: true } } } });
  if (!req || req.doneAt || !(await canOn(actor, req.listingId, "checkIn"))) return false;
  await db.$transaction(async (tx) => {
    await tx.cleaningRequest.update({ where: { id }, data: { doneAt: now, doneById: actor.id } });
    await audit(tx, { actorId: actor.id, action: "stay.cleaningDone", entityType: "booking", entityId: req.booking.reference });
    await notify(tx, req.booking.guestId, "cleaningDone", { reference: req.booking.reference }, "/my-stay");
  });
  return true;
}
