"use client";

import {
  BadgePercent,
  Bell,
  UserRound,
  CalendarCheck,
  ClipboardList,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MessageSquareWarning,
  ScrollText,
  Settings,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { LogoMark } from "@/components/ui/Logo";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type Key = "overview" | "listings" | "bookings" | "money" | "promotions" | "moderation" | "support" | "users" | "settings" | "audit" | "account" | "notifications";

const GROUPS: { label: "operate" | "money" | "people" | "system"; items: { key: Key; href: string; icon: LucideIcon }[] }[] = [
  {
    label: "operate",
    items: [
      { key: "overview", href: "/admin", icon: LayoutDashboard },
      { key: "listings", href: "/admin/listings", icon: Home },
      { key: "bookings", href: "/admin/bookings", icon: CalendarCheck },
      { key: "moderation", href: "/admin/moderation", icon: MessageSquareWarning },
      { key: "support", href: "/admin/support", icon: LifeBuoy },
    ],
  },
  {
    label: "money",
    items: [
      { key: "money", href: "/admin/money", icon: Wallet },
      { key: "promotions", href: "/admin/promotions", icon: BadgePercent },
    ],
  },
  { label: "people", items: [{ key: "users", href: "/admin/users", icon: Users }] },
  {
    label: "system",
    items: [
      { key: "settings", href: "/admin/settings", icon: Settings },
      { key: "audit", href: "/admin/audit", icon: ScrollText },
    ],
  },
];

/** Pages reached from the top bar (not listed in the sidebar), so the top bar can name them. */
const EXTRA: { key: Key; href: string; icon: LucideIcon }[] = [
  { key: "account", href: "/admin/account", icon: UserRound },
  { key: "notifications", href: "/admin/notifications", icon: Bell },
];

const isOn = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));

/**
 * Staff dashboard frame: a sidebar of sections (with how many items wait in each) beside the page, a top bar with
 * the page's name and a way back to the public site. Phones get the sidebar as a slide-in menu.
 */
export function AdminShell({
  user,
  counts,
  unread,
  languageSwitcher,
  children,
}: {
  user: { name: string; email: string };
  counts: Partial<Record<Key, number>>;
  /** Unread notifications, for the bell. */
  unread: number;
  /** The language switcher (rendered on the server side of the layout). */
  languageSwitcher: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("Admin.nav");
  const tAdmin = useTranslations("Admin");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = [...GROUPS.flatMap((g) => g.items), ...EXTRA].find((i) => isOn(pathname, i.href)) ?? GROUPS[0]!.items[0]!;

  const sidebar = (
    // Any link tapped in the phone menu closes it.
    <div className="flex h-full flex-col" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
      <Link href="/admin" className="flex items-center gap-3 px-5 py-5">
        <LogoMark className="size-9" />
        <span className="flex flex-col leading-tight">
          <span className="text-[15px] font-bold text-ink">Space Rental</span>
          <span className="text-xs font-semibold tracking-wide text-primary uppercase">{tAdmin("console")}</span>
        </span>
      </Link>
      <nav aria-label={t("label")} className="flex-1 overflow-y-auto px-3 pb-4">
        {GROUPS.map((group) => (
          <div key={group.label} className="mt-4 first:mt-1">
            <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{t(`group.${group.label}`)}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(({ key, href, icon: Icon }) => {
                const on = isOn(pathname, href);
                const count = counts[key] ?? 0;
                return (
                  <li key={key}>
                    <Link
                      href={href}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors duration-200",
                        on ? "bg-primary font-semibold text-white shadow-[0_6px_16px_-8px_rgba(0,87,184,0.9)]" : "text-ink/80 hover:bg-canvas hover:text-ink",
                      )}
                    >
                      <Icon className={cn("size-[18px] shrink-0", on ? "text-white" : "text-ink/60 group-hover:text-primary")} strokeWidth={1.9} aria-hidden="true" />
                      <span className="flex-1">{t(key)}</span>
                      {count > 0 && (
                        <span
                          className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums", on ? "bg-white/25 text-white" : "bg-primary/10 text-primary")}
                          aria-label={tAdmin("waiting", { count })}
                        >
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <Link
          href="/admin/account"
          aria-current={isOn(pathname, "/admin/account") ? "page" : undefined}
          className={cn("flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-canvas", isOn(pathname, "/admin/account") && "bg-canvas")}
        >
          <Avatar name={user.name} className="size-9 text-sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink">{user.name}</span>
            <span className="block truncate text-xs text-muted">{user.email}</span>
          </span>
          <Settings className="size-4 text-ink/50" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>

      {/* Phone / tablet menu */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div aria-hidden="true" onClick={() => setOpen(false)} className="absolute inset-0 bg-[#00142e]/40 motion-safe:animate-[fade-in_250ms_ease-out]" />
          <aside className="relative h-full w-72 max-w-[85%] bg-surface shadow-[12px_0_40px_-12px_rgba(16,24,40,0.4)]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={tAdmin("closeMenu")}
              className="absolute top-5 right-3 flex size-9 items-center justify-center rounded-full text-ink hover:bg-canvas"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-md md:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={tAdmin("openMenu")}
            aria-expanded={open}
            className="flex size-10 items-center justify-center rounded-xl border border-line text-ink lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ClipboardList className="hidden size-5 text-primary md:block" aria-hidden="true" />
            <h1 className="truncate text-[17px] font-bold tracking-[-0.01em] text-ink">{t(current.key)}</h1>
          </div>
          <Link
            href="/admin/notifications"
            aria-label={unread > 0 ? tAdmin("notificationsUnread", { count: unread }) : t("notifications")}
            className="relative flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas hover:text-primary"
          >
            <Bell className="size-5" aria-hidden="true" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-surface">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <div className="hidden sm:block">{languageSwitcher}</div>
          <Link href="/admin/account" aria-label={t("account")} className="rounded-full focus-visible:outline-2 focus-visible:outline-primary">
            <Avatar name={user.name} className="size-9 text-sm" />
          </Link>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
