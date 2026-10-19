"use client";

import { Bell, CalendarDays, KeyRound, LifeBuoy, LogOut, MessageSquare, Plus, UserRound, UtensilsCrossed } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Link, usePathname } from "@/i18n/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

/** Computers: the avatar opens a small menu instead of a full page. */
export function AccountMenu({ name, image }: { name: string; image?: string | null }) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [shownOn, setShownOn] = useState(pathname);
  const box = useRef<HTMLDivElement>(null);
  // Close after moving to another page.
  if (shownOn !== pathname) {
    setShownOn(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    const result = await authClient.signOut().catch(() => ({ error: true }));
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (!result?.error) window.location.assign(`/${locale}`);
  }

  const item = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] text-ink transition-colors hover:bg-canvas";
  const links = [
    { href: "/profile", icon: UserRound, label: t("profile") },
    { href: "/bookings", icon: CalendarDays, label: t("bookings") },
    { href: "/chats", icon: MessageSquare, label: t("messages") },
    { href: "/restaurants", icon: UtensilsCrossed, label: t("restaurants") },
    { href: "/notifications", icon: Bell, label: t("notifications") },
    { href: "/host", icon: KeyRound, label: t("yourPlaces") },
    { href: "/host/listings/new", icon: Plus, label: t("addPlace") },
    { href: "/support", icon: LifeBuoy, label: t("help") },
  ];

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("accountMenu")}
        onClick={() => setOpen(!open)}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Avatar name={name} image={image} />
      </button>
      {open && (
        <div role="menu" className="absolute top-full right-0 z-50 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-[0_18px_40px_-16px_rgba(16,24,40,0.45)] motion-safe:animate-pop-in">
          <p className="truncate px-3 pt-1 pb-2 text-[13px] font-semibold text-muted">{name}</p>
          {links.map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} role="menuitem" className={cn(item, pathname === href && "font-semibold text-primary")}>
              <Icon className="size-4.5 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          ))}
          <div className="my-1 border-t border-line" />
          <button type="button" role="menuitem" onClick={signOut} className={cn(item, "text-danger hover:bg-danger/[0.05]")}>
            <LogOut className="size-4.5 shrink-0" aria-hidden="true" />
            {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
