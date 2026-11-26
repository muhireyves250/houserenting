"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { decidePromoterReward, deletePromoter, markPromoterRewardPaid, savePromoter, setPromoterStatus, staffAddPromoter, staffEditPromoter, type PromoterInput, type StaffPromoterResult, approvePromoter, givePromoCode, type FirstCodeInput, setPromoterPeriod } from "./service";

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

export async function staffAddPromoterAction(email: string, input: PromoterInput, firstCode: FirstCodeInput): Promise<StaffPromoterResult> {
  const user = await getCurrentUser();
  if (!user || typeof email !== "string" || email.length > 200) return { ok: false, error: "notAllowed" };
  const result = await staffAddPromoter(user, email, input, firstCode);
  if (result.ok) revalidatePath("/[locale]", "layout");
  return result;
}

export async function staffEditPromoterAction(promoterId: string, input: PromoterInput, period?: { startsOn: string; endsOn: string } | null): Promise<StaffPromoterResult> {
  const user = await getCurrentUser();
  if (!user || typeof promoterId !== "string" || promoterId.length > 64) return { ok: false, error: "notAllowed" };
  // Their period first (so a wrong date changes nothing).
  if (period && typeof period.startsOn === "string" && typeof period.endsOn === "string") {
    const changed = await setPromoterPeriod(user, promoterId, period.startsOn, period.endsOn);
    if (!changed.ok) return changed.error === "dates" ? { ok: false, errors: { endsOn: "dates" } } : { ok: false, error: changed.error ?? "notFound" };
  }
  const result = await staffEditPromoter(user, promoterId, input);
  if (result.ok) revalidatePath("/[locale]", "layout");
  return result;
}

export async function deletePromoterAction(promoterId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || typeof promoterId !== "string" || promoterId.length > 64) return { ok: false };
  const result = await deletePromoter(user, promoterId);
  if (result.ok) revalidatePath("/[locale]", "layout");
  return result.ok ? { ok: true } : { ok: false, error: "error" in result ? result.error : undefined };
}

/** Approve someone who asked to be a promoter, with their promo code. */
export async function approvePromoterAction(promoterId: string, firstCode: FirstCodeInput): Promise<StaffPromoterResult> {
  const user = await getCurrentUser();
  if (!user || typeof promoterId !== "string" || promoterId.length > 64) return { ok: false, error: "notAllowed" };
  const result = await approvePromoter(user, promoterId, firstCode);
  if (result.ok) revalidatePath("/[locale]", "layout");
  return result;
}

/** Give an active promoter another promo code. */
export async function givePromoCodeAction(promoterId: string, code: FirstCodeInput): Promise<StaffPromoterResult> {
  const user = await getCurrentUser();
  if (!user || typeof promoterId !== "string" || promoterId.length > 64) return { ok: false, error: "notAllowed" };
  const result = await givePromoCode(user, promoterId, code);
  if (result.ok) revalidatePath("/[locale]", "layout");
  return result;
}
