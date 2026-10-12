"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchState } from "@/features/search/search-store";
import { useSearchSummaries } from "@/features/search/use-search-summaries";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { HERO_SEARCH_ID, SearchBar, type SearchPanel } from "./SearchBar";

type HeroState = "absent" | "visible" | "hidden";

/**
 * Compact "Anywhere | Any dates | Add guests" pill shown in the header once the hero search scrolls away.
 * Clicking a part expands the full search (same component and shared values) at the top of the page.
 */
export function HeaderSearch() {
  const t = useTranslations("Home");
  const [search] = useSearchState();
  const { whenSummary, whoSummary } = useSearchSummaries(search);
  // The header stays mounted across client navigations, so all state is keyed by pathname:
  // a new page starts "absent" until its own hero (if any) is observed.
  const pathname = usePathname();
  const [observed, setObserved] = useState<{ path: string; visible: boolean } | null>(null);
  const [opened, setOpened] = useState<{ path: string; panel: SearchPanel } | null>(null);
  const hero: HeroState = observed?.path === pathname ? (observed.visible ? "visible" : "hidden") : "absent";
  const expanded = opened?.path === pathname ? opened.panel : null;
  const setExpanded = (panel: SearchPanel | null) => setOpened(panel ? { path: pathname, panel } : null);
  const triggers = useRef<Partial<Record<SearchPanel, HTMLButtonElement | null>>>({});

  useEffect(() => {
    const target = document.getElementById(HERO_SEARCH_ID);
    if (!target) return;
    // 64px top margin = the sticky header, so the pill appears exactly when the hero bar slides under it.
    const observer = new IntersectionObserver(
      ([entry]) => setObserved({ path: pathname, visible: entry.isIntersecting }),
      { rootMargin: "-64px 0px 0px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [pathname]);

  function collapse(from: SearchPanel) {
    setExpanded(null);
    // Return keyboard focus to the pill part that opened the search.
    triggers.current[from]?.focus({ preventScroll: true });
  }

  // Collapse back to the pill when the page scrolls, like the hero bar going out of view.
  useEffect(() => {
    if (!expanded) return;
    const onScroll = () => setOpened(null);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [expanded]);

  if (hero !== "hidden") return null;

  const part = "whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors duration-300 hover:bg-ink/[0.06]";

  return (
    <>
      <div
        role="group"
        aria-label={t("compactLabel")}
        data-header-search
        className={cn(
          "hidden items-center rounded-full border border-line bg-surface py-1 pr-1 pl-1 shadow-sm lg:flex",
          "motion-safe:animate-pop-in",
        )}
      >
        <button
          ref={(el) => {
            triggers.current.where = el;
          }}
          type="button"
          className={cn(part, "font-medium text-ink")}
          onClick={() => setExpanded("where")}
        >
          {search.location || t("compactWhere")}
        </button>
        {search.mode === "short" && (
          <>
            <span className="h-5 w-px bg-line" aria-hidden="true" />
            <button
              ref={(el) => {
                triggers.current.when = el;
              }}
              type="button"
              className={cn(part, "font-medium text-ink")}
              onClick={() => setExpanded("when")}
            >
              {whenSummary ?? t("compactWhen")}
            </button>
            <span className="h-5 w-px bg-line" aria-hidden="true" />
            <button
              ref={(el) => {
                triggers.current.who = el;
              }}
              type="button"
              className={cn(part, whoSummary ? "text-ink" : "text-muted")}
              onClick={() => setExpanded("who")}
            >
              {whoSummary ?? t("whoPlaceholder")}
            </button>
          </>
        )}
        <span className="ml-1 flex size-8 items-center justify-center rounded-full bg-primary text-white" aria-hidden="true">
          <Search className="size-4" />
        </span>
      </div>

      {expanded &&
        createPortal(
          <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-6 motion-safe:animate-pop-in">
            <SearchBar initialOpen={expanded} onClose={() => collapse(expanded)} />
          </div>,
          document.body,
        )}
    </>
  );
}
