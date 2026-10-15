"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { sendMessage, startConversation, type StartResult } from "./service";

const id = z.string().min(1).max(64);

export async function startConversationAction(listingId: string): Promise<StartResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!id.safeParse(listingId).success) return { ok: false, error: "notFound" };
  return startConversation(user.id, listingId);
}

export async function sendMessageAction(conversationId: string, body: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(conversationId).success || typeof body !== "string") return { ok: false };
  const ok = await sendMessage(user.id, conversationId, body);
  if (ok) revalidatePath("/[locale]/chats", "layout");
  return { ok };
}
