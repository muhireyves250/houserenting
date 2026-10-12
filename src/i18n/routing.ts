import { hasLocale } from "next-intl";
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "rw", "fr"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];

export function toAppLocale(value: unknown): AppLocale {
  return typeof value === "string" && hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}
