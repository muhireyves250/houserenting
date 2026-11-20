"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { SignOutButton } from "@/features/users/components/SignOutButton";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { ACCOUNT_ITEMS } from "./account-items";


const isOn = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * Computers: the guest's account menu beside every account page (like the dashboards' sidebar): who they are, then
 * their pages with the current one in solid blue. Phones keep the bottom tabs instead.
 */
export function AccountNav({ user, unread }: { user: { name: string; email: string; image: string | null }; unread: number }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  return (
    // Fills the screen's height under the header and stays put while the page scrolls.
    <aside className="sticky top-[96px] hidden h-[calc(100dvh-160px)] min-h-[24rem] self-start lg:block">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-primary/25 bg-surface shadow-card">
        <Link href="/profile/personal" className="flex items-center gap-3 border-b border-line px-4 py-4 transition-colors hover:bg-canvas/60">
          <Avatar name={user.name} image={user.image} className="size-11 text-sm" />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold text-ink">{user.name}</span>
            <span className="block truncate text-[12px] text-muted">{user.email}</span>
          </span>
        </Link>
        <nav aria-label={t("accountMenu")} data-lenis-prevent className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
          <ul className="flex flex-col gap-0.5">
            {ACCOUNT_ITEMS.map(({ key, href, icon: Icon }) => {
              const on = isOn(pathname, href) && !(href === "/profile" && pathname !== "/profile" && pathname !== "/profile/personal");
              return (
                <li key={key}>
                  <Link
                    href={href}
                    prefetch
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors duration-150",
                      on ? "bg-primary font-semibold text-white" : "text-ink/75 hover:bg-primary/[0.08] hover:text-primary",
                    )}
                  >
                    <Icon className={cn("size-[18px] shrink-0", on ? "text-white" : "text-ink/50 group-hover:text-primary")} strokeWidth={1.9} aria-hidden="true" />
                    <span className="flex-1">{t(`account.${key}` as "account.bookings")}</span>
                    {key === "notifications" && unread > 0 && (
                      <span className={cn("min-w-5 rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums", on ? "bg-white/25 text-white" : "bg-primary/10 text-primary")}>{unread}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="border-t border-line px-3 py-2">
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}
