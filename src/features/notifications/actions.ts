"use server";

import { getCurrentUser } from "@/lib/session";
import { markAllRead } from "./service";

export async function markAllReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) await markAllRead(user.id);
}
