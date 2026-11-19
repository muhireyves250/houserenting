"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

export type SlidingTab = {
  key: string;
  label: string;
  short?: string;
  icon: ReactNode;
  href: string | { pathname: string; query?: Record<string, string> };
  on: boolean;
  count?: number;
};

const MOTION = "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none";

/**
 * Page tabs with the same motion as the login / sign-up switch: the blue pill slides to the chosen tab (at once,
 * before the page arrives) and a soft shade follows the mouse.
 */
export function SlidingTabs({ items, label }: { items: SlidingTab[]; label: string }) {
  const current = Math.max(0, items.findIndex((i) => i.on));
  const [picked, setPicked] = useState<{ index: number; from: number } | null>(null);
  // A tap moves the pill straight away; once the new page says which tab is on, that wins again.
  const selected = picked && picked.from === current ? picked.index : current;
  const [hovered, setHovered] = useState<number | null>(null);
  const [hoverAt, setHoverAt] = useState(0);
  const router = useRouter();
  const [loading, start] = useTransition();
  // The other tabs load in the background, so switching is quick.
  useEffect(() => {
    for (const item of items) if (!item.on) router.prefetch(item.href);
  }, [items, router]);
  // While the new tab loads, the page under the tabs fades and a thin bar runs along the top.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-tab-loading", loading);
    return () => document.documentElement.removeAttribute("data-tab-loading");
  }, [loading]);
  const pill = (index: number) => ({ width: `${100 / items.length}%`, transform: `translateX(${index * 100}%)` });

  return (
    <nav
      aria-label={label}
      aria-busy={loading}
      className={cn("shrink-0 rounded-full p-1.5 ring-1 ring-line transition-colors duration-500 motion-reduce:transition-none", hovered !== null ? "bg-[#e3e6ea]" : "bg-surface")}
    >
      {loading && <span aria-hidden="true" className="tab-loading-bar fixed inset-x-0 top-0 z-[70] h-[3px]" />}
      <div className="relative grid" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }} onMouseLeave={() => setHovered(null)}>
        <span aria-hidden="true" style={pill(hoverAt)} className={cn("pointer-events-none absolute inset-y-0 left-0 rounded-full bg-black/[0.07]", MOTION, hovered !== null ? "opacity-100" : "opacity-0")} />
        <span aria-hidden="true" style={pill(selected)} className={cn("pointer-events-none absolute inset-y-0 left-0 rounded-full bg-primary shadow-[0_6px_16px_-8px_rgba(0,64,160,0.7)]", MOTION)} />
        {items.map(({ key, label: name, short, icon, href, count }, index) => {
          const on = index === selected;
          return (
            <Link
              key={key}
              href={href}
              aria-current={index === current ? "page" : undefined}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                setPicked({ index, from: current });
                start(() => router.push(href));
              }}
              onMouseEnter={() => {
                setHovered(index);
                setHoverAt(index);
              }}
              className={cn(
                "relative z-10 flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-[13px] font-semibold transition-colors duration-500 sm:gap-2 sm:px-3 sm:text-[14px]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&_svg]:size-4 [&_svg]:shrink-0",
                on ? "text-white" : "text-ink/75",
              )}
            >
              {icon}
              <span className={cn("truncate", short && "sm:hidden")}>{short ?? name}</span>
              {short && <span className="hidden truncate sm:inline">{name}</span>}
              {count !== undefined && count > 0 && (
                <span className={cn("rounded-full px-1.5 text-[11px] font-bold tabular-nums transition-colors duration-500", on ? "bg-white/25 text-white" : "bg-primary/10 text-primary")}>{count}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
