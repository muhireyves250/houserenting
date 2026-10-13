"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

/** Each language in its own name, so people recognise theirs whatever the current UI language. */
const NATIVE_NAMES: Record<AppLocale, string> = { en: "English", rw: "Ikinyarwanda", fr: "Français" };

/** Footer language links: the same page in another language. */
export function FooterLanguages() {
  const t = useTranslations("Footer");
  const current = useLocale();
  const pathname = usePathname();
  return (
    <nav aria-label={t("language")}>
      <ul className="inline-flex flex-wrap gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10">
        {routing.locales.map((locale) => {
          const active = locale === current;
          return (
            <li key={locale}>
              <Link
                href={pathname}
                locale={locale}
                lang={locale}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "block rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-300",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                  active ? "bg-white text-primary shadow-sm" : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                {NATIVE_NAMES[locale]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
