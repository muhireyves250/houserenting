"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useSearchState, type SearchPanel } from "@/features/search/search-store";
import { useSearchSummaries } from "@/features/search/use-search-summaries";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { HERO_SEARCH_ID } from "./SearchBar";

type HeroState = "absent" | "visible" | "hidden";

/**
 * Compact "Anywhere | Any dates | Add guests" pill shown in the header once the hero search scrolls away.
 * Clicking a part smoothly scrolls back to the hero and asks it to open that panel.
 */
export function HeaderSearch() {
  const t = useTranslations("Home");
  const [search, setSearch] = useSearchState();
  const { whenSummary, whoSummary } = useSearchSummaries(search);

  // The header stays mounted across client navigations, so visibility is keyed by pathname:
  // a new page starts "absent" until its own hero (if any) is observed.
  const pathname = usePathname();
  const [observed, setObserved] = useState<{ path: string; visible: boolean } | null>(null);
  const hero: HeroState = observed?.path === pathname ? (observed.visible ? "visible" : "hidden") : "absent";

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

  if (hero !== "hidden") return null;

  function openInHero(panel: SearchPanel) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    setSearch({ openRequest: { panel, at: Date.now() } });
  }

  const part = "whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors duration-300 hover:bg-ink/[0.06]";

  return (
    <div
      role="group"
      aria-label={t("compactLabel")}
      data-header-search
      className="hidden items-center rounded-full border border-line bg-surface py-1 pr-1 pl-1 shadow-sm motion-safe:animate-pop-in lg:flex"
    >
      <button type="button" className={cn(part, "font-medium text-ink")} onClick={() => openInHero("where")}>
        {search.location || t("compactWhere")}
      </button>
      {search.mode === "short" && (
        <>
          <span className="h-5 w-px bg-line" aria-hidden="true" />
          <button type="button" className={cn(part, "font-medium text-ink")} onClick={() => openInHero("when")}>
            {whenSummary ?? t("compactWhen")}
          </button>
          <span className="h-5 w-px bg-line" aria-hidden="true" />
          <button type="button" className={cn(part, whoSummary ? "text-ink" : "text-muted")} onClick={() => openInHero("who")}>
            {whoSummary ?? t("whoPlaceholder")}
          </button>
        </>
      )}
      <span className="ml-1 flex size-8 items-center justify-center rounded-full bg-primary text-white" aria-hidden="true">
        <Search className="size-4" />
      </span>
    </div>
  );
}
