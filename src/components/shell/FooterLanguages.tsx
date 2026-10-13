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
      <ul className="flex flex-wrap gap-1.5">
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
                  "block rounded-full border px-3 py-1 text-[13px] font-medium transition-colors duration-300",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  active ? "border-primary bg-primary/[0.06] text-primary" : "border-line text-ink/70 hover:border-primary/60 hover:text-ink",
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
