"use client";

import { useTranslations } from "next-intl";
import { useState, type FocusEvent, type MouseEvent } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS } from "./nav-items";

type Box = { left: number; width: number };

export function HeaderNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  // Same hover language as the search bar: one pill slides behind the link under the mouse (or focus).
  const [box, setBox] = useState<Box>({ left: 0, width: 0 });
  const [visible, setVisible] = useState(false);

  function track(event: MouseEvent<HTMLAnchorElement> | FocusEvent<HTMLAnchorElement>) {
    const el = event.currentTarget;
    // The current page already has its own solid pill; don't stack the shade on top of it.
    if (el.getAttribute("aria-current") === "page") return setVisible(false);
    setBox({ left: el.offsetLeft, width: el.offsetWidth });
    setVisible(true);
  }

  return (
    <nav aria-label={t("mainNav")} onMouseLeave={() => setVisible(false)}>
      <ul className="relative flex items-center gap-2" onBlur={() => setVisible(false)}>
        <span
          data-testid="nav-hover"
          data-visible={visible}
          aria-hidden="true"
          style={{ width: `${box.width}px`, transform: `translateX(${box.left}px)` }}
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 rounded-full bg-primary/[0.08]",
            "transition-[transform,width,opacity] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none",
            "group-data-[overlay=true]/header:bg-white/15",
            visible ? "opacity-100" : "opacity-0",
          )}
        />
        {NAV_ITEMS.filter((item) => item.key !== "profile").map(({ key, href }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onMouseEnter={track}
                onFocus={track}
                className={cn(
                  "relative block rounded-full px-4 py-2 text-[15px] font-semibold tracking-[0.01em]",
                  "transition-[background-color,border-color,color] duration-300",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  // Same footprint for every link so the outline doesn't shift the layout.
                  "border",
                  active
                    ? // Current page: outlined pill; border deepens and a faint tint appears on hover.
                      cn(
                        "border-primary text-primary hover:border-primary-hover hover:bg-primary/[0.06]",
                        "group-data-[overlay=true]/header:border-white group-data-[overlay=true]/header:text-white group-data-[overlay=true]/header:hover:bg-white/10",
                      )
                    : cn(
                        "border-transparent text-ink/80 hover:text-ink",
                        "group-data-[overlay=true]/header:text-white/85 group-data-[overlay=true]/header:hover:text-white",
                      ),
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
