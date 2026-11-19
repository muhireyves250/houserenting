"use client";

import {
  BadgePercent,
  Bell,
  UserRound,
  CalendarCheck,
  ChartColumn,
  ClipboardList,
  Home,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  MessageSquare,
  MessageSquareWarning,
  QrCode,
  ScrollText,
  Settings,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
  type LucideIcon, ChevronDown, Shirt, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { LogoMark } from "@/components/ui/Logo";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

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
      { key: "restaurants", href: "/admin/restaurants", icon: UtensilsCrossed },
      { key: "laundry", href: "/admin/laundry", icon: Shirt },
    ],
  },
  {
    label: "care",
    items: [
      { key: "support", href: "/admin/support", icon: LifeBuoy },
      { key: "moderation", href: "/admin/moderation", icon: MessageSquareWarning },
    ],
  },
  {
    label: "money",
    items: [
      { key: "money", href: "/admin/money", icon: Wallet },
      { key: "reports", href: "/admin/reports", icon: ChartColumn },
      { key: "promotions", href: "/admin/promotions", icon: BadgePercent },
      { key: "promoters", href: "/admin/promoters", icon: QrCode },
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

const FOLDED_KEY = "viipa-admin-folded";
const foldedListeners = new Set<() => void>();
const subscribeFolded = (listener: () => void) => {
  foldedListeners.add(listener);
  return () => foldedListeners.delete(listener);
};
const readFolded = () => {
  try {
    return window.localStorage.getItem(FOLDED_KEY) ?? "[]";
  } catch {
    return "[]";
  }
};
const writeFolded = (value: string) => {
  try {
    window.localStorage.setItem(FOLDED_KEY, value);
  } catch {
    // Private mode: folding isn't remembered after a reload.
  }
  foldedListeners.forEach((listener) => listener());
};

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
  // Groups folded by this person, remembered in this browser (all open while the page loads).
  const foldedRaw = useSyncExternalStore(subscribeFolded, readFolded, () => "[]");
  const folded = useMemo<Group[]>(() => {
    try {
      const list = JSON.parse(foldedRaw) as unknown;
      return Array.isArray(list) ? (list as Group[]) : [];
    } catch {
      return [];
    }
  }, [foldedRaw]);
  const toggle = (group: Group) => writeFolded(JSON.stringify(folded.includes(group) ? folded.filter((g) => g !== group) : [...folded, group]));
  const current = [...GROUPS.flatMap((g) => g.items), ...EXTRA].find((i) => isOn(pathname, i.href)) ?? GROUPS[0]!.items[0]!;

  const sidebar = (
    // Any link tapped in the phone menu closes it.
    <div className="flex h-full flex-col" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
      <Link href="/admin" className="flex items-center gap-3 border-b border-line/60 px-5 py-4">
        <LogoMark className="h-7" />
        <span className="flex flex-col leading-tight">
          <span className="text-[15px] font-bold text-ink">VIIPA</span>
          <span className="text-xs font-semibold tracking-wide text-primary uppercase">{tAdmin("console")}</span>
        </span>
      </Link>
      <nav aria-label={t("label")} className="flex-1 overflow-y-auto px-3 pt-3 pb-4">
        {GROUPS.map((group) => {
          const hasCurrent = group.items.some((i) => isOn(pathname, i.href));
          // The group with the page you're on stays open.
          const isFolded = group.label !== "home" && folded.includes(group.label) && !hasCurrent;
          const waiting = group.items.reduce((n, i) => n + (counts[i.key] ?? 0), 0);
          return (
            <div key={group.label} className={cn(group.label === "home" ? "mt-1" : "mt-3 border-t border-line/60 pt-3")}>
              {group.label !== "home" && (
                <button
                  type="button"
                  onClick={() => toggle(group.label)}
                  aria-expanded={!isFolded}
                  className="group/title mb-1 flex w-full items-center gap-2 rounded-md px-3 py-1 text-left text-[10.5px] font-semibold tracking-[0.08em] text-muted/90 uppercase transition-colors hover:text-ink"
                >
                  <span className="flex-1">{t(`group.${group.label}`)}</span>
                  {/* Folded: what waits inside still shows. */}
                  {isFolded && waiting > 0 && <span className="rounded-full bg-primary/10 px-1.5 text-[11px] font-bold tracking-normal text-primary tabular-nums">{waiting}</span>}
                  <ChevronDown className={cn("size-3.5 opacity-50 transition-[transform,opacity] group-hover/title:opacity-100", isFolded && "-rotate-90")} aria-hidden="true" />
                </button>
              )}
              {!isFolded && (
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
                            "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors duration-150",
                            // Current page: a soft blue highlight with a slim bar on the left.
                            on
                              ? "bg-primary/[0.08] font-semibold text-primary before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-primary"
                              : "text-ink/75 hover:bg-canvas hover:text-ink",
                          )}
                        >
                          <Icon className={cn("size-[18px] shrink-0", on ? "text-primary" : "text-ink/50 group-hover:text-ink/80")} strokeWidth={1.9} aria-hidden="true" />
                          <span className="flex-1">{t(key)}</span>
                          {count > 0 && (
                            <span
                              className={cn("min-w-5 rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums", on ? "bg-primary text-white" : "bg-primary/10 text-primary")}
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
              )}
            </div>
          );
        })}
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
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-5 backdrop-blur-md md:px-10">
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
        <main className="admin-cards px-5 py-6 pb-28 md:px-10 md:py-8 lg:pb-8">{children}</main>
      </div>

      {/* Phones and tablets: the main admin pages one tap away, and Menu for everything else. */}
      {!/^\/admin\/messages\/[^/]+/.test(pathname) && (
        <nav aria-label={t("label")} className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(6px+env(safe-area-inset-bottom))] lg:hidden" data-print-hide>
          <ul className="mx-auto flex w-full max-w-md items-center rounded-full bg-surface/95 p-1.5 shadow-[0_14px_36px_-12px_rgba(0,40,100,0.45)] ring-1 ring-line backdrop-blur-xl">
            {BOTTOM.map(({ key, href, icon: Icon }) => {
              const on = href === "/admin" ? pathname === "/admin" : isOn(pathname, href);
              const count = counts[key] ?? 0;
              return (
                <li key={key} className="min-w-0 flex-1">
                  <Link
                    href={href}
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
