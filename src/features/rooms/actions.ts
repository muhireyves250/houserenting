"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { removeRoom, saveRoom, setRoomStatus, type SaveRoomResult } from "./service";
import { ROOM_STATUSES, type RoomInput, type RoomStatus } from "./validation";

const id = z.string().min(1).max(64);

function refresh() {
  revalidatePath("/[locale]", "layout");
}

export async function saveRoomAction(listingId: string, roomId: string | null, input: RoomInput): Promise<SaveRoomResult> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(listingId).success || (roomId !== null && !id.safeParse(roomId).success)) return { ok: false };
  const result = await saveRoom(user, listingId, roomId, input);
  if (result.ok) refresh();
  return result;
}

export async function setRoomStatusAction(roomId: string, status: RoomStatus): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(roomId).success || !ROOM_STATUSES.includes(status)) return { ok: false };
  const ok = await setRoomStatus(user, roomId, status);
  if (ok) refresh();
  return { ok };
}

export async function removeRoomAction(roomId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(roomId).success) return { ok: false };
  const result = await removeRoom(user, roomId);
  if (result) refresh();
  return { ok: result !== false };
}
