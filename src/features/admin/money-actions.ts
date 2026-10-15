"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordSettlement, type SettlementResult } from "@/features/ledger/service";
import { createPromo, setPromoActive, type PromoInput } from "@/features/promotions/service";
import { decideReward } from "@/features/referrals/service";
import { isAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

const id = z.string().min(1).max(64);

async function staff() {
  const user = await getCurrentUser();
  return user && isAdmin(user) ? user : null;
}

export async function recordSettlementAction(input: { hostId: string; amount: number; method: string; externalReference: string }): Promise<SettlementResult | { ok: false; error: "auth" }> {
  const admin = await staff();
  if (!admin) return { ok: false, error: "auth" };
  if (!id.safeParse(input?.hostId).success || typeof input.method !== "string" || typeof input.externalReference !== "string") return { ok: false, error: "invalid" };
  const result = await recordSettlement(admin.id, input);
  if (result.ok) revalidatePath("/[locale]/admin/money", "page");
  return result;
}

export async function decideRewardAction(rewardId: string, approve: boolean): Promise<{ ok: boolean }> {
  const admin = await staff();
  if (!admin || !id.safeParse(rewardId).success) return { ok: false };
  const ok = await decideReward(admin.id, rewardId, approve === true);
  if (ok) revalidatePath("/[locale]/admin/money", "page");
  return { ok };
}

export async function createPromoAction(input: PromoInput): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  const admin = await staff();
  if (!admin) return { ok: false, errors: { form: "auth" } };
  const result = await createPromo(admin.id, input);
  if (result.ok) revalidatePath("/[locale]/admin/promotions", "page");
  return result;
}

export async function setPromoActiveAction(promoId: string, active: boolean): Promise<{ ok: boolean }> {
  const admin = await staff();
  if (!admin || !id.safeParse(promoId).success) return { ok: false };
  const ok = await setPromoActive(admin.id, promoId, active === true);
  if (ok) revalidatePath("/[locale]/admin/promotions", "page");
  return { ok };
}
