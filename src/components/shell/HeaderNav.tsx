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
      <ul className="flex items-center gap-8">
        {NAV_ITEMS.filter((item) => item.key !== "profile").map(({ key, href }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative py-1 text-[15px] font-semibold tracking-[0.01em] transition-colors duration-300",
                  // Underline grows from the centre on hover; stays for the current page.
                  "after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:origin-center after:rounded-full after:bg-primary",
                  "after:transition-transform after:duration-300 after:ease-out hover:after:scale-x-100 motion-reduce:after:transition-none",
                  active ? "text-primary after:scale-x-100" : "text-ink/80 after:scale-x-0 hover:text-ink",
                  "group-data-[overlay=true]/header:text-white/85 group-data-[overlay=true]/header:after:bg-white group-data-[overlay=true]/header:hover:text-white",
                  active && "group-data-[overlay=true]/header:text-white",
                )}
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
