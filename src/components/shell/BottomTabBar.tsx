"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS, navHref } from "./nav-items";

/** `signedIn` decides whether members-only tabs go straight to the page or open the login modal. */
export function BottomTabBar({ signedIn = true }: { signedIn?: boolean }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("mainNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={navHref(href, signedIn)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 pt-2.5 pb-2 text-xs transition-colors duration-200 active:scale-95",
                  active ? "font-semibold text-primary" : "font-medium text-ink/60",
                )}
              >
                <Icon className={cn("size-6 transition-transform duration-300", active && "scale-110")} strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
