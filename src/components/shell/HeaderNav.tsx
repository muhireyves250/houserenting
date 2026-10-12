"use client";

import { useTranslations } from "next-intl";
import { useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS, navHref } from "./nav-items";

type Box = { left: number; width: number };

const SLIDE = "duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none";

/** `signedIn` decides whether members-only links go straight to the page or open the login modal. */
export function HeaderNav({ signedIn = true }: { signedIn?: boolean }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const outlineRef = useRef<HTMLSpanElement>(null);

  // Hover: one shade slides behind the link under the mouse (or keyboard focus).
  const [box, setBox] = useState<Box>({ left: 0, width: 0 });
  // Keyed by pathname: after clicking a link, the shade clears as that link becomes the current page.
  const [shownOn, setShownOn] = useState<string | null>(null);
  const visible = shownOn === pathname;
  const setVisible = (show: boolean) => setShownOn(show ? pathname : null);
  const [hoveringCurrent, setHoveringCurrent] = useState(false);

  // Current page: one outlined pill that slides to the new link when the page changes.
  // Positioned imperatively from layout measurements (no re-render needed).
  useLayoutEffect(() => {
    const list = listRef.current;
    const outline = outlineRef.current;
    if (!list || !outline) return;
    const place = () => {
      const current = list.querySelector<HTMLElement>('a[aria-current="page"]');
      if (!current) {
        outline.style.opacity = "0";
        return;
      }
      outline.style.opacity = "1";
      outline.style.width = `${current.offsetWidth}px`;
      outline.style.transform = `translateX(${current.offsetLeft}px)`;
    };
    place();
    // First placement snaps into position; later page changes slide.
    const frame = requestAnimationFrame(() => outline.setAttribute("data-ready", "true"));
    // Re-measure when the header reflows (e.g. window resize, font load).
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    resize?.observe(list);
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
    };
  }, [pathname]);

  function track(event: MouseEvent<HTMLAnchorElement> | FocusEvent<HTMLAnchorElement>) {
    const el = event.currentTarget;
    const current = el.getAttribute("aria-current") === "page";
    setHoveringCurrent(current);
    // The current page already has its outline; don't stack the shade on top of it.
    if (current) return setVisible(false);
    setBox({ left: el.offsetLeft, width: el.offsetWidth });
    setVisible(true);
  }

  function leave() {
    setVisible(false);
    setHoveringCurrent(false);
  }

  return (
    <nav aria-label={t("mainNav")} onMouseLeave={leave}>
      <ul ref={listRef} className="relative flex items-center gap-2" onBlur={leave}>
        <span
          data-testid="nav-hover"
          data-visible={visible}
          aria-hidden="true"
          style={{ width: `${box.width}px`, transform: `translateX(${box.left}px)` }}
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 rounded-full bg-primary/[0.08] transition-[transform,width,opacity]",
            SLIDE,
            "group-data-[overlay=true]/header:bg-white/15",
            visible ? "opacity-100" : "opacity-0",
          )}
        />
        <span
          ref={outlineRef}
          data-testid="nav-active"
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 rounded-full border border-primary",
            "data-[ready=true]:transition-[transform,width,opacity,background-color,border-color]",
            SLIDE,
            "group-data-[overlay=true]/header:border-white",
            hoveringCurrent && "border-primary-hover bg-primary/[0.06] group-data-[overlay=true]/header:bg-white/10",
          )}
        />
        {NAV_ITEMS.filter((item) => item.key !== "profile").map(({ key, href }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={navHref(href, signedIn)}
                aria-current={active ? "page" : undefined}
                onMouseEnter={track}
                onFocus={track}
                className={cn(
                  "relative block rounded-full px-4 py-2 text-[15px] font-semibold tracking-[0.01em] transition-colors duration-300",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  active
                    ? "text-primary group-data-[overlay=true]/header:text-white"
                    : "text-ink/80 hover:text-ink group-data-[overlay=true]/header:text-white/85 group-data-[overlay=true]/header:hover:text-white",
                )}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
