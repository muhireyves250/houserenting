"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { answerQuestion, askQuestion, type AskResult } from "./service";

const id = z.string().min(1).max(64);

export async function askQuestionAction(listingId: string, text: string): Promise<AskResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  if (!id.safeParse(listingId).success || typeof text !== "string") return { ok: false, error: "invalid" };
  return askQuestion(user.id, listingId, text);
}

export async function answerQuestionAction(questionId: string, text: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(questionId).success || typeof text !== "string") return { ok: false };
  const ok = await answerQuestion(user, questionId, text);
  if (ok) {
    revalidatePath("/[locale]/host", "page");
    revalidatePath("/[locale]/admin/moderation", "page");
  }
  return { ok };
}
