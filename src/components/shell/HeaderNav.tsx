"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS } from "./nav-items";

export function HeaderNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("mainNav")}>
      <ul className="flex items-center gap-6">
        {NAV_ITEMS.filter((item) => item.key !== "profile").map(({ key, href }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("text-sm font-medium transition-colors hover:text-primary", active ? "text-primary" : "text-ink")}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
