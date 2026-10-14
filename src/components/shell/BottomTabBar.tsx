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
  const shadeRef = useRef<HTMLSpanElement>(null);

  // Hover: one soft shade slides to the tab under the pointer (the site's sliding hover), following its
  // width as the name appears. It stays where it was while fading out.
  useLayoutEffect(() => {
    const list = listRef.current;
    const shade = shadeRef.current;
    if (!list || !shade) return;
    const tab = hovered ? list.querySelector<HTMLElement>(`a[data-tab="${hovered}"]`) : null;
    const isCurrent = tab?.getAttribute("aria-current") === "page";
    shade.style.opacity = tab && !isCurrent ? "1" : "0";
    if (!tab || isCurrent) return;
    const place = () => {
      shade.style.width = `${tab.offsetWidth}px`;
      shade.style.transform = `translateX(${tab.offsetLeft}px)`;
    };
    place();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    resize?.observe(tab);
    return () => resize?.disconnect();
  }, [hovered]);

  // Place the pill under the current tab, measured from layout (no re-render). It follows the tab's
  // width as its name expands, and slides after the first placement.
  useLayoutEffect(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;
    const place = () => {
      const current = list.querySelector<HTMLElement>('a[aria-current="page"]');
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
  }, [pathname]);

  return (
    <nav
      aria-label={t("mainNav")}
      className="fixed inset-x-0 bottom-[calc(12px+env(safe-area-inset-bottom))] z-40 px-4 md:hidden"
    >
      <ul
        ref={listRef}
        onPointerLeave={() => setHovered(null)}
        className="relative mx-auto flex w-full max-w-md items-center justify-between rounded-full bg-surface/90 p-1.5 shadow-[0_14px_36px_-12px_rgba(0,40,100,0.45)] ring-1 ring-line backdrop-blur-xl"
      >
        <span
          ref={shadeRef}
          data-testid="tab-hover"
          aria-hidden="true"
          style={{ opacity: 0 }}
          className={cn("pointer-events-none absolute top-1.5 bottom-1.5 left-0 rounded-full bg-primary/[0.1] transition-[transform,width,opacity]", SLIDE)}
        />
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
          const labelled = active || hovered === key;
          return (
            // Natural sizes, spread with equal gaps across the fixed-width bar.
            <li
              key={key}
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
                  "relative flex h-12 items-center justify-center gap-2 rounded-full transition-[background-color,color,padding,width]",
                  SLIDE,
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95",
                  labelled ? "px-4" : "w-12",
                  active ? "text-white" : "text-primary",
                )}
              >
                <Icon className="size-[22px] shrink-0" strokeWidth={2} aria-hidden="true" />
                {labelled && (
                  <span aria-hidden="true" className="text-sm font-semibold whitespace-nowrap motion-safe:animate-[fade-in_400ms_ease-out]">
                    {t(key)}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
