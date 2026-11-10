import type { BookedRange } from "@/features/search/date-range";

type Taken = BookedRange & { roomId: string | null };
export type RoomDayStatus = { free: true } | { free: false; freeFrom: string };

const nextDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * Whether a room is free on a day (for a night or for day use): taken by its own bookings and blocks, and by
 * whole-place ones. When taken, the first day it is free again (back-to-back bookings are followed through).
 */
export function roomStatusOn(taken: Taken[], roomId: string, day: string): RoomDayStatus {
  const mine = taken.filter((b) => b.roomId === null || b.roomId === roomId);
  let cursor = day;
  for (let guard = 0; guard < 1000; guard++) {
    const hit = mine.find((b) => b.checkIn <= cursor && cursor < b.checkOut);
    if (!hit) return cursor === day ? { free: true } : { free: false, freeFrom: cursor };
    cursor = hit.checkOut > cursor ? hit.checkOut : nextDay(cursor);
  }
  return { free: false, freeFrom: cursor };
}
