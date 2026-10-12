"use server";

import { revalidatePath } from "next/cache";
import type { AppLocale } from "@/i18n/routing";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/session";
import { firstErrors } from "@/lib/zod-errors";
import { profileSchema, type ProfileErrorKey } from "./schemas";
import { updateProfile } from "./service";

export type ProfileFormState = {
  status: "idle" | "saved" | "error";
  errors?: Partial<Record<"name" | "phone" | "locale" | "form", ProfileErrorKey>>;
  locale?: AppLocale;
};

export async function updateProfileAction(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", errors: { form: "generic" } };

  const parsed = profileSchema.safeParse({
    name: formData.get("name") ?? "",
    phone: formData.get("phone") ?? "",
    locale: formData.get("locale") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", errors: firstErrors(parsed.error) as ProfileFormState["errors"] };
  }

  try {
    await updateProfile(user.id, parsed.data);
  } catch (err) {
    logger.error({ err, userId: user.id }, "profile update failed");
    return { status: "error", errors: { form: "generic" } };
  }
  revalidatePath("/[locale]", "layout");
  return { status: "saved", locale: parsed.data.locale };
}
