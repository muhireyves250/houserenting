"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

const ITEMS = [
  { key: "overview", href: "/admin" },
  { key: "moderation", href: "/admin/moderation" },
  { key: "support", href: "/admin/support" },
  { key: "bookings", href: "/admin/bookings" },
  { key: "settings", href: "/admin/settings" },
  { key: "users", href: "/admin/users" },
  { key: "audit", href: "/admin/audit" },
] as const;

export function AdminNav({ counts }: { counts: Partial<Record<(typeof ITEMS)[number]["key"], number>> }) {
  const t = useTranslations("Admin.nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} className="-mx-4 mb-6 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      <ul className="flex w-max gap-2">
        {ITEMS.map(({ key, href }) => {
          const active = href === "/admin" ? pathname === "/admin" || pathname.startsWith("/admin/listings") : pathname.startsWith(href);
          const count = counts[key] ?? 0;
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors duration-300",
                  active ? "border-primary bg-primary font-semibold text-white" : "border-line bg-surface text-ink hover:border-primary/60",
                )}
              >
                {t(key)}
                {count > 0 && (
                  <span className={cn("rounded-full px-1.5 text-xs font-bold", active ? "bg-white/25 text-white" : "bg-primary/10 text-primary")}>{count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
