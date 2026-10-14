"use client";

import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS, navHref } from "./nav-items";

// The site's sliding motion (header nav, search bar, filters).
const SLIDE = "duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none";

/**
 * Phones: a floating navy glass bar. Tabs are icons; the current one is a blue pill with its name,
 * and that pill slides and stretches to the tapped tab. Members-only tabs open the login modal when signed out.
 */
export function BottomTabBar({ signedIn = true }: { signedIn?: boolean }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

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
      className="fixed inset-x-0 bottom-[calc(12px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 md:hidden"
    >
      <ul
        ref={listRef}
        className="relative flex items-center gap-1 rounded-full bg-[#001a3d]/88 p-1.5 shadow-[0_18px_40px_-14px_rgba(0,20,60,0.7),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/10 backdrop-blur-xl"
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
          return (
            <li key={key}>
              <Link
                href={navHref(href, signedIn)}
                aria-label={t(key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-12 items-center justify-center gap-2 rounded-full text-white/70 transition-[padding,color]",
                  SLIDE,
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95",
                  active ? "px-4 text-white" : "w-12",
                )}
              >
                <Icon className="size-[22px] shrink-0" strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" />
                {active && (
                  <span aria-hidden="true" className="text-[15px] font-semibold whitespace-nowrap motion-safe:animate-[fade-in_400ms_ease-out]">
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
