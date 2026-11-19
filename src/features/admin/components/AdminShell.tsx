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
  MessageSquare,
  Settings,
  Wallet,
  X,
  type LucideIcon, Shirt, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { LogoMark, LogoWordmark } from "@/components/ui/Logo";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { StaffArea } from "@/lib/roles";

type Key = "orders" | "laundry" | "messages" | "reports" | "overview" | "listings" | "bookings" | "requests" | "restaurants" | "promoters" | "money" | "promotions" | "moderation" | "support" | "users" | "settings" | "audit" | "account" | "notifications";

type Group = "home" | "stays" | "services" | "care" | "money" | "people" | "system";

/** The sidebar, in groups (Overview on its own at the top). Each titled group folds and unfolds. */
const GROUPS: { label: Group; items: { key: Key; href: string; icon: LucideIcon }[] }[] = [
  { label: "home", items: [{ key: "overview", href: "/admin", icon: LayoutDashboard }] },
  {
    label: "stays",
    items: [
      { key: "listings", href: "/admin/listings", icon: Home },
      { key: "bookings", href: "/admin/bookings", icon: CalendarCheck },
      { key: "messages", href: "/admin/messages", icon: MessageSquare },
    ],
  },
  {
    label: "services",
    items: [
      { key: "orders", href: "/admin/orders", icon: ShoppingBag },
      { key: "laundry", href: "/admin/laundry", icon: Shirt },
    ],
  },
  {
    label: "care",
    items: [
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
  {
    label: "system",
    items: [
      { key: "settings", href: "/admin/settings", icon: Settings },
    ],
  },
];


/** The sidebar: every staff page in one list, in this order. */
const NAV = GROUPS.flatMap((g) => g.items);

/** Pages reached from the top bar (not listed in the sidebar), so the top bar can name them. */
/** The phone bottom bar: the pages staff open most. */
const BOTTOM: { key: "overview" | "bookings" | "orders" | "messages"; href: string; icon: LucideIcon }[] = [
  { key: "overview", href: "/admin", icon: LayoutDashboard },
  { key: "bookings", href: "/admin/bookings", icon: CalendarCheck },
  { key: "orders", href: "/admin/orders", icon: ShoppingBag },
  { key: "messages", href: "/admin/messages", icon: MessageSquare },
];

const EXTRA: { key: Key; href: string; icon: LucideIcon }[] = [
  { key: "account", href: "/admin/account", icon: UserRound },
  { key: "notifications", href: "/admin/notifications", icon: Bell },
];

/** The staff area each page belongs to (Overview, account and notices are for all staff). */
const AREA_OF: Partial<Record<Key, StaffArea>> = {
  listings: "listings",
  bookings: "bookings",
  messages: "messages",
  orders: "food",
  laundry: "laundry",
  support: "support",
  money: "money",
  promotions: "promotions",
  settings: "settings",
};

const isOn = (pathname: string, href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));

/**
 * Staff dashboard frame: a sidebar of sections (with how many items wait in each) beside the page, a top bar with
 * the page's name and a way back to the public site. Phones get the sidebar as a slide-in menu.
 */
export function AdminShell({
  user,
  areas,
  counts,
  unread,
  languageSwitcher,
  children,
}: {
  user: { name: string; email: string };
  /** What this staff member may manage: the sidebar and bottom bar show only these. */
  areas: readonly StaffArea[];
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
  // An open conversation uses the whole phone screen (its answer box sits at the bottom), so no bottom bar there.
  const bottomBar = !/^\/admin\/messages\/[^/]+/.test(pathname);
  const allowed = (key: Key) => {
    const area = AREA_OF[key];
    return !area || areas.includes(area);
  };
  const current = [...GROUPS.flatMap((g) => g.items), ...EXTRA].find((i) => isOn(pathname, i.href)) ?? GROUPS[0]!.items[0]!;

  const sidebar = (
    // Any link tapped in the phone menu closes it.
    <div className="flex h-full flex-col" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
      <Link href="/admin" className="flex items-start gap-3 border-b border-line/60 px-5 py-4">
        <LogoMark className="h-7" />
        <span className="flex flex-col gap-1 leading-tight">
          <LogoWordmark className="h-3" priority />
          <span className="text-xs font-semibold tracking-wide text-primary uppercase">{tAdmin("console")}</span>
        </span>
      </Link>
      <nav aria-label={t("label")} className="flex-1 overflow-y-auto px-3 pt-3 pb-4">
        {/* One plain list (no groups). */}
        <ul className="mt-1 flex flex-col gap-0.5">
          {NAV.filter((i) => allowed(i.key)).map(({ key, href, icon: Icon }) => {
            const on = isOn(pathname, href);
            const count = counts[key] ?? 0;
            return (
              <li key={key}>
                <Link
                  href={href}
                  // Staff pages load fully in the background so opening one is instant.
                  prefetch
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors duration-150",
                    // Current page: a solid blue button; the others turn light blue under the pointer.
                    on
                      ? "bg-primary font-semibold text-white"
                      : "text-ink/75 hover:bg-primary/[0.08] hover:text-primary",
                  )}
                >
                  <Icon className={cn("size-[18px] shrink-0", on ? "text-white" : "text-ink/50 group-hover:text-primary")} strokeWidth={1.9} aria-hidden="true" />
                  <span className="flex-1">{t(key)}</span>
                  {count > 0 && (
                    <span
                      className={cn("min-w-5 rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums", on ? "bg-white/25 text-white" : "bg-primary/10 text-primary")}
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
    // Staff pages scroll natively: their lists and sidebar scroll inside their own boxes, which the site's
    // smooth wheel scrolling (Lenis) would otherwise take over.
    <div className="min-h-dvh bg-canvas" data-lenis-prevent>
      {/* Desktop sidebar */}
      <aside data-print-hide className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>

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

      <div className="lg:pl-64 print:pl-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-7 backdrop-blur-md md:px-20">
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
        {/* Phones: room under the page for the bottom bar. */}
        <main className={cn("admin-cards px-7 py-6 md:px-20 md:py-8 lg:pb-8", bottomBar ? "pb-24" : "pb-6")}>{children}</main>
      </div>

      {/* Phones and tablets: the main admin pages one tap away, and Menu for everything else. */}
      {bottomBar && (
        <nav aria-label={t("label")} className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(6px+env(safe-area-inset-bottom))] lg:hidden" data-print-hide>
          <ul className="mx-auto flex w-full max-w-md items-center rounded-full bg-surface/95 p-1.5 shadow-[0_14px_36px_-12px_rgba(0,40,100,0.45)] ring-1 ring-line backdrop-blur-xl">
            {BOTTOM.filter((i) => allowed(i.key)).map(({ key, href, icon: Icon }) => {
              const on = href === "/admin" ? pathname === "/admin" : isOn(pathname, href);
              const count = counts[key] ?? 0;
              return (
                <li key={key} className="min-w-0 flex-1">
                  <Link
                    href={href}
                    prefetch
                    aria-current={on ? "page" : undefined}
                    className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-full transition-colors", on ? "bg-primary text-white" : "text-primary")}
                  >
                    <Icon className="size-[21px]" strokeWidth={2} aria-hidden="true" />
                    <span className={cn("max-w-full truncate px-1 text-[10.5px] leading-tight", on ? "font-semibold" : "font-medium")}>{t(`short.${key}`)}</span>
                    {count > 0 && (
                      <span className="absolute top-1 right-[calc(50%-20px)] flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-surface" aria-label={tAdmin("waiting", { count })}>
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
            <li className="min-w-0 flex-1">
              <button type="button" onClick={() => setOpen(true)} aria-expanded={open} className="flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-full text-primary">
                <Menu className="size-[21px]" strokeWidth={2} aria-hidden="true" />
                <span className="text-[10.5px] leading-tight font-medium">{t("short.menu")}</span>
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
