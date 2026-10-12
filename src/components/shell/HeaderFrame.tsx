"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

const TOP_THRESHOLD = 8;

function subscribeScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/**
 * Sticky header shell. On the home page it starts transparent over the hero (`data-overlay="true"`)
 * and turns into a frosted white bar once the page scrolls. Children style themselves with
 * `group-data-[overlay=true]/header:*` variants.
 */
export function HeaderFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const atTop = useSyncExternalStore(subscribeScroll, () => window.scrollY < TOP_THRESHOLD, () => true);
  const overlay = pathname === "/" && atTop;

  return (
    <header
      data-overlay={overlay}
      className={cn(
        "group/header sticky top-0 z-40 hidden border-b md:block",
        "transition-[background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none",
        overlay
          ? "border-transparent bg-transparent"
          : "border-line/70 bg-surface/90 shadow-[0_8px_24px_-14px_rgba(0,20,60,0.22)] backdrop-blur-md",
      )}
    >
      {children}
    </header>
  );
}
