import "server-only";
import { audit } from "@/features/audit/service";
import { db } from "@/lib/db";
import { canOn } from "./access";
import type { Actor } from "./status-service";

export const BLOCK_KINDS = ["MAINTENANCE", "UNAVAILABLE", "OFFLINE_BOOKING"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

/** The owner, a manager, or staff. */
const canManage = (actor: Actor, listingId: string) => canOn(actor, listingId, "blocks");

export type BlockResult = { ok: true; overlapping: number } | { ok: false; error: "notAllowed" | "invalid" };

/**
 * Takes the whole place, or one room, out of booking from `startsAt` until `endsAt` (or until ended, when unknown).
 * Existing bookings in that time stay; their count is returned so staff can contact the guests.
 */
export async function createBlock(
  actor: Actor,
  listingId: string,
  input: { roomId: string | null; kind: BlockKind; startsAt: Date; endsAt: Date | null; reason: string },
): Promise<BlockResult> {
  const reason = input.reason.trim().slice(0, 300);
  if (!BLOCK_KINDS.includes(input.kind) || !reason || Number.isNaN(input.startsAt.getTime()) || (input.endsAt && input.endsAt <= input.startsAt)) {
    return { ok: false, error: "invalid" };
  }
  if (!(await canManage(actor, listingId))) return { ok: false, error: "notAllowed" };
  if (input.roomId && !(await db.room.findFirst({ where: { id: input.roomId, listingId }, select: { id: true } }))) return { ok: false, error: "invalid" };
  return db.$transaction(async (tx) => {
    const block = await tx.availabilityBlock.create({ data: { listingId, roomId: input.roomId, kind: input.kind, startsAt: input.startsAt, endsAt: input.endsAt, reason, createdById: actor.id } });
    await audit(tx, {
      actorId: actor.id,
      action: "block.create",
      entityType: "listing",
      entityId: listingId,
      data: { block: block.id, kind: input.kind, room: input.roomId, from: input.startsAt.toISOString(), to: input.endsAt?.toISOString() ?? "open", reason },
    });
    const overlapping = await tx.booking.count({
      where: {
        listingId,
        status: { in: ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] },
        endAt: { gt: input.startsAt },
        ...(input.endsAt ? { startAt: { lt: input.endsAt } } : {}),
        ...(input.roomId ? { OR: [{ roomId: input.roomId }, { roomId: null }] } : {}),
      },
    });
    return { ok: true, overlapping } as const;
  });
}

/** Ends a block now (the room or place is bookable again); the record is kept. */
export async function endBlock(actor: Actor, blockId: string, now: Date = new Date()): Promise<boolean> {
  const block = await db.availabilityBlock.findUnique({ where: { id: blockId }, select: { listingId: true, endedAt: true, endsAt: true } });
  if (!block || block.endedAt || !(await canManage(actor, block.listingId))) return false;
  return db.$transaction(async (tx) => {
    await tx.availabilityBlock.update({ where: { id: blockId }, data: { endedAt: now, endedById: actor.id, endsAt: block.endsAt && block.endsAt < now ? block.endsAt : now } });
    await audit(tx, { actorId: actor.id, action: "block.end", entityType: "listing", entityId: block.listingId, data: { block: blockId } });
    return true;
  });
}

/** Current and upcoming blocks, then past ones (history), with the room name. */
export async function listingBlocks(listingId: string, now: Date = new Date()) {
  const blocks = await db.availabilityBlock.findMany({ where: { listingId }, orderBy: { startsAt: "desc" }, take: 100 });
  const rooms = await db.room.findMany({ where: { listingId }, select: { id: true, name: true } });
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const active = (b: (typeof blocks)[number]) => !b.endedAt && (!b.endsAt || b.endsAt > now);
  return {
    active: blocks.filter(active).map((b) => ({ ...b, room: b.roomId ? (roomName.get(b.roomId) ?? null) : null })),
    past: blocks.filter((b) => !active(b)).map((b) => ({ ...b, room: b.roomId ? (roomName.get(b.roomId) ?? null) : null })),
  };
}
