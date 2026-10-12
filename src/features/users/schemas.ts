import { z } from "zod";
import type { Messages } from "@/i18n/messages";
import { routing } from "@/i18n/routing";

export type ProfileErrorKey = keyof Messages["Profile"]["errors"];

/** Returns an E.164 number, or null if the input is not a plausible phone number. */
export function normalizePhone(raw: string): string | null {
  let value = raw.replace(/[\s\-().]/g, "");
  if (/^07\d{8}$/.test(value)) value = `+250${value.slice(1)}`;
  else if (/^2507\d{8}$/.test(value)) value = `+${value}`;
  else if (value.startsWith("00")) value = `+${value.slice(2)}`;
  return /^\+[1-9]\d{7,14}$/.test(value) ? value : null;
}

export const profileSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(80, "nameTooLong"),
  phone: z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === "") return null;
      const phone = normalizePhone(value);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: "phoneInvalid" });
        return z.NEVER;
      }
      return phone;
    }),
  locale: z.enum(routing.locales, "localeInvalid"),
});

export type ProfileInput = z.output<typeof profileSchema>;
