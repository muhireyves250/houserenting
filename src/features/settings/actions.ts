"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";
import { updateSettings, type UpdateResult } from "./service";
import type { SettingsInput } from "./validation";

export async function updateSettingsAction(input: SettingsInput): Promise<UpdateResult | { ok: false; errors: { form: "auth" } }> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return { ok: false, errors: { form: "auth" } };
  const result = await updateSettings(user.id, input);
  if (result.ok) revalidatePath("/[locale]", "layout");
  return result;
}
