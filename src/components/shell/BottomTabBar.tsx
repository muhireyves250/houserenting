"use client";

import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS, navHref } from "./nav-items";

// The site's sliding motion (header nav, search bar, filters).
const SLIDE = "duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none";

/**
 * Phones: a floating white glass bar in the brand colours (blue edge and icons). Tabs are icons; the current one is a blue pill with its name,
 * and that pill slides and stretches to the tapped tab. Members-only tabs open the login modal when signed out.
 */
export function BottomTabBar({ signedIn = true }: { signedIn?: boolean }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  // Tab under the mouse / finger: it shows its name too (the bar's width never changes; tabs share it).
  const [hovered, setHovered] = useState<string | null>(null);

  // Place the pill under the current tab, measured from layout (no re-render). It follows the tab's
  // width as its name expands, and slides after the first placement.
  useLayoutEffect(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;
    const place = () => {
      // One indicator: the blue pill sits on the hovered tab, otherwise on the current one.
      const current =
        (hovered ? list.querySelector<HTMLElement>(`a[data-tab="${hovered}"]`) : null) ??
        list.querySelector<HTMLElement>('a[aria-current="page"]');
      pill.style.opacity = current ? "1" : "0";
      if (!current) return;
      pill.style.width = `${current.offsetWidth}px`;
      pill.style.transform = `translateX(${current.offsetLeft}px)`;
    };
    place();
    const frame = requestAnimationFrame(() => pill.setAttribute("data-ready", "true"));
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (resize) for (const el of list.querySelectorAll("a")) resize.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
    };
  }, [pathname, hovered]);

  return (
    <nav
      aria-label={t("mainNav")}
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(1px+env(safe-area-inset-bottom))] md:hidden"
    >
      <ul
        ref={listRef}
        onPointerLeave={() => setHovered(null)}
        className="relative mx-auto flex w-full max-w-md items-center rounded-full bg-surface/90 p-1.5 shadow-[0_14px_36px_-12px_rgba(0,40,100,0.45)] ring-1 ring-line backdrop-blur-xl"
      >
        <span
          ref={pillRef}
          data-testid="tab-pill"
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1.5 bottom-1.5 left-0 rounded-full bg-primary shadow-[0_6px_16px_-6px_rgba(0,87,184,0.9),inset_0_1px_0_rgba(255,255,255,0.25)]",
            "data-[ready=true]:transition-[transform,width]",
            SLIDE,
          )}
        />
        {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          // White while the pill is under it: the hovered tab, or the current tab when nothing is hovered.
          const onPill = hovered ? hovered === key : active;
          return (
            // Equal widths across the fixed-width bar.
            <li
              key={key}
              className="min-w-0 flex-1"
              onPointerEnter={() => setHovered(key)}
              onPointerDown={() => setHovered(key)}
            >
              <Link
                href={navHref(href, signedIn)}
                aria-label={t(key)}
                data-tab={key}
                aria-current={active ? "page" : undefined}
                onFocus={() => setHovered(key)}
                onBlur={() => setHovered(null)}
                className={cn(
                  "relative flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-full transition-[color]",
                  SLIDE,
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95",
                  onPill ? "text-white" : "text-primary",
                )}
              >
                <Icon className="size-[22px] shrink-0" strokeWidth={2} aria-hidden="true" />
                {/* Name under the icon, on every tab. */}
                <span aria-hidden="true" className={cn("max-w-full truncate text-[11px] leading-tight", onPill ? "font-semibold" : "font-medium")}>
                  {t(key)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
