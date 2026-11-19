"use client";

import { Bell, ChefHat, ClipboardList, House, LayoutDashboard, Menu, Settings, UtensilsCrossed, Wallet, X, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { LogoMark, LogoWordmark } from "@/components/ui/Logo";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type Key = "overview" | "places" | "orders" | "payout" | "restaurants" | "account" | "notifications";

const NAV: { key: Key; href: string; icon: LucideIcon }[] = [
  { key: "overview", href: "/host", icon: LayoutDashboard },
  { key: "places", href: "/host/places", icon: House },
  { key: "orders", href: "/host/orders", icon: UtensilsCrossed },
  { key: "payout", href: "/host/payout", icon: Wallet },
  { key: "restaurants", href: "/host/restaurants", icon: ChefHat },
];

/** Reached from the top bar, so the top bar can name them. */
const EXTRA: { key: Key; href: string; icon: LucideIcon }[] = [
  { key: "account", href: "/host/account", icon: Settings },
  { key: "notifications", href: "/host/notifications", icon: Bell },
];

/** Place pages (/host/listings/…) belong to Places. */
const isOn = (pathname: string, key: Key, href: string) =>
  key === "overview" ? pathname === "/host" : key === "places" ? pathname.startsWith("/host/places") || pathname.startsWith("/host/listings") : pathname === href || pathname.startsWith(`${href}/`);

/**
 * The house owner's dashboard frame, built like the staff one: a sidebar beside the page on computers, a top bar with
 * the page's name, and a bottom bar on phones. Owners see their own places and money only.
 */
export function HostShell({
  user,
  kitchens,
  counts,
  unread,
  languageSwitcher,
  children,
}: {
  user: { name: string; email: string };
  /** Kitchen teams VIIPA set up for this person (shows Kitchens). */
  kitchens: boolean;
  counts: Partial<Record<Key, number>>;
  unread: number;
  /** The language switcher (rendered on the server side of the layout). */
  languageSwitcher: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("Host.shell");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = NAV.filter((i) => i.key !== "restaurants" || kitchens);
  const current = [...nav, ...EXTRA].find((i) => isOn(pathname, i.key, i.href)) ?? nav[0]!;

  const sidebar = (
    <div className="flex h-full flex-col" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
      <Link href="/host" className="flex items-start gap-3 border-b border-line/60 px-5 py-4">
        <LogoMark className="h-7" />
        <span className="flex flex-col gap-1 leading-tight">
          <LogoWordmark className="h-3" priority />
          <span className="text-xs font-semibold tracking-wide text-primary uppercase">{t("console")}</span>
        </span>
      </Link>
      <nav aria-label={t("label")} className="flex-1 overflow-y-auto px-3 pt-3 pb-4">
        <ul className="mt-1 flex flex-col gap-0.5">
          {nav.map(({ key, href, icon: Icon }) => {
            const on = isOn(pathname, key, href);
            const count = counts[key] ?? 0;
            return (
              <li key={key}>
                <Link
                  href={href}
                  prefetch
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition-colors duration-150",
                    on ? "bg-primary font-semibold text-white" : "text-ink/75 hover:bg-primary/[0.08] hover:text-primary",
                  )}
                >
                  <Icon className={cn("size-[18px] shrink-0", on ? "text-white" : "text-ink/50 group-hover:text-primary")} strokeWidth={1.9} aria-hidden="true" />
                  <span className="flex-1">{t(`nav.${key}`)}</span>
                  {count > 0 && (
                    <span className={cn("min-w-5 rounded-full px-1.5 py-px text-center text-[11px] font-semibold tabular-nums", on ? "bg-white/25 text-white" : "bg-primary/10 text-primary")}>{count}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-line p-3">
        <Link
          href="/host/account"
          aria-current={pathname === "/host/account" ? "page" : undefined}
          className={cn("flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-canvas", pathname === "/host/account" && "bg-canvas")}
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

  const bottom = nav.filter((i) => i.key !== "restaurants");

  return (
    <div className="min-h-dvh bg-canvas" data-lenis-prevent>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div aria-hidden="true" onClick={() => setOpen(false)} className="absolute inset-0 bg-[#00142e]/40 motion-safe:animate-[fade-in_250ms_ease-out]" />
          <aside className="relative h-full w-72 max-w-[85%] bg-surface shadow-[12px_0_40px_-12px_rgba(16,24,40,0.4)]">
            <button type="button" onClick={() => setOpen(false)} aria-label={t("closeMenu")} className="absolute top-5 right-3 flex size-9 items-center justify-center rounded-full text-ink hover:bg-canvas">
              <X className="size-5" aria-hidden="true" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-7 backdrop-blur-md md:px-20">
          <button type="button" onClick={() => setOpen(true)} aria-label={t("openMenu")} aria-expanded={open} className="flex size-10 items-center justify-center rounded-xl border border-line text-ink lg:hidden">
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ClipboardList className="hidden size-5 text-primary md:block" aria-hidden="true" />
            <h1 className="truncate text-[17px] font-bold tracking-[-0.01em] text-ink">{t(`nav.${current.key}`)}</h1>
          </div>
          <Link
            href="/host/notifications"
            aria-label={unread > 0 ? t("notificationsUnread", { count: unread }) : t("notifications")}
            className="relative flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas hover:text-primary"
          >
            <Bell className="size-5" aria-hidden="true" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-surface">{unread > 99 ? "99+" : unread}</span>
            )}
          </Link>
          <div className="hidden sm:block">{languageSwitcher}</div>
          <Link href="/host/account" aria-label={t("account")} className="rounded-full focus-visible:outline-2 focus-visible:outline-primary">
            <Avatar name={user.name} className="size-9 text-sm" />
          </Link>
        </header>
        <main className="admin-cards px-7 py-6 pb-24 md:px-20 md:py-8 lg:pb-8">{children}</main>
      </div>

      {/* Phones and tablets: the owner's pages one tap away, and Menu for the rest. */}
      <nav aria-label={t("label")} className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(6px+env(safe-area-inset-bottom))] lg:hidden">
        <ul className="mx-auto flex w-full max-w-md items-center rounded-full bg-surface/95 p-1.5 shadow-[0_14px_36px_-12px_rgba(0,40,100,0.45)] ring-1 ring-line backdrop-blur-xl">
          {bottom.map(({ key, href, icon: Icon }) => {
            const on = isOn(pathname, key, href);
            const count = counts[key] ?? 0;
            return (
              <li key={key} className="min-w-0 flex-1">
                <Link href={href} prefetch aria-current={on ? "page" : undefined} className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-full transition-colors", on ? "bg-primary text-white" : "text-primary")}>
                  <Icon className="size-[21px]" strokeWidth={2} aria-hidden="true" />
                  <span className={cn("max-w-full truncate px-1 text-[10.5px] leading-tight", on ? "font-semibold" : "font-medium")}>{t(`short.${key as "overview"}`)}</span>
                  {count > 0 && (
                    <span className="absolute top-1 right-[calc(50%-20px)] flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-4 font-bold text-white ring-2 ring-surface">{count > 99 ? "99+" : count}</span>
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
    </div>
  );
}
