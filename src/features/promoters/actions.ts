"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { decidePromoterReward, markPromoterRewardPaid, savePromoter, setPromoterStatus, type PromoterInput } from "./service";

const id = z.string().min(1).max(64);
const refresh = () => revalidatePath("/[locale]", "layout");

export async function savePromoterAction(input: PromoterInput) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, errors: { form: "auth" } };
  const result = await savePromoter(user.id, input);
  if (result.ok) refresh();
  return result;
}

export async function setPromoterStatusAction(promoterId: string, status: "ACTIVE" | "SUSPENDED", reason: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(promoterId).success || (status !== "ACTIVE" && status !== "SUSPENDED")) return { ok: false };
  const ok = await setPromoterStatus(user, promoterId, status, typeof reason === "string" ? reason : "");
  if (ok) refresh();
  return { ok };
}

export async function decidePromoterRewardAction(rewardId: string, approve: boolean): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(rewardId).success || typeof approve !== "boolean") return { ok: false };
  const ok = await decidePromoterReward(user, rewardId, approve);
  if (ok) refresh();
  return { ok };
}

export async function markPromoterRewardPaidAction(rewardId: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(rewardId).success) return { ok: false };
  const ok = await markPromoterRewardPaid(user, rewardId);
  if (ok) refresh();
  return { ok };
}
