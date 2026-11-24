"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/session";
import { requestPayout, type PayoutRequestResult } from "./service";

/** The signed-in owner asks VIIPA to send what they're owed now. */
export async function requestPayoutAction(): Promise<PayoutRequestResult | { ok: false; error: "auth" }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const result = await requestPayout(user.id);
  if (result.ok) revalidatePath("/[locale]", "layout");
  return result;
}
