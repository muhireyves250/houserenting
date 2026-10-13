"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchState, type SearchPanel } from "@/features/search/search-store";
import { useSearchSummaries } from "@/features/search/use-search-summaries";
import { usePathname } from "@/i18n/navigation";
import { animateScrollTo } from "@/lib/animate-scroll";
import { cn } from "@/lib/cn";
import { HERO_SEARCH_ID, SearchBar } from "./SearchBar";

// Pages whose body starts with the big hero search (home, and the direct login/signup/forgot backdrops).
const HERO_PATHS = new Set(["/", "/login", "/signup", "/forgot-password"]);
// Matches the exit animations below.
const CLOSE_MS = 320;

/**
 * Compact "Anywhere | Any dates | Add guests" search in the header.
 * - Pages with the hero search: shown once the hero scrolls away; a click glides back and opens that panel there.
 * - Every other page: always shown; a click opens the full search in a band under the header.
 * Laptops below 1280px get a single "Search" button so the nav links keep their room.
 */
export function HeaderSearch({ today }: { today?: string }) {
  const t = useTranslations("Home");
  const [search, setSearch] = useSearchState();
  const { whenSummary, whoSummary } = useSearchSummaries(search);
  const pathname = usePathname();
  const hasHero = HERO_PATHS.has(pathname);

  // The header stays mounted across client navigations, so hero visibility is keyed by pathname.
  const [observed, setObserved] = useState<{ path: string; visible: boolean } | null>(null);
  const heroHidden = observed?.path === pathname && !observed.visible;
  // Full search floating over the blurred page (pages without a hero), keyed by pathname so navigating closes it.
  // `closing` plays the exit animation before it unmounts.
  const [dropdown, setDropdown] = useState<{ path: string; panel: SearchPanel; closing?: boolean } | null>(null);
  const openPanel = dropdown?.path === pathname ? dropdown.panel : null;
  const closing = Boolean(dropdown?.closing);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
  function closeDropdown() {
    setDropdown((current) => (current ? { ...current, closing: true } : null));
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setDropdown(null), CLOSE_MS);
  }

  useEffect(() => {
    if (!hasHero) return;
    const target = document.getElementById(HERO_SEARCH_ID);
    if (!target) return;
    // 72px top margin = the sticky header, so the pill appears exactly when the hero bar slides under it.
    const observer = new IntersectionObserver(
      ([entry]) => setObserved({ path: pathname, visible: entry.isIntersecting }),
      { rootMargin: "-72px 0px 0px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [pathname, hasHero]);

  if (hasHero && !heroHidden) return null;

  async function open(panel: SearchPanel) {
    if (!hasHero) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      return setDropdown({ path: pathname, panel });
    }
    // Eased glide back to the hero, then open the panel there so the two motions don't fight.
    await animateScrollTo(0);
    setSearch({ openRequest: { panel, at: Date.now() } });
  }

  const part = "whitespace-nowrap rounded-full px-3.5 py-2 text-sm transition-colors duration-300 hover:bg-ink/[0.06]";
  const shell =
    "hidden items-center rounded-full border border-primary bg-surface py-1 pr-1 pl-1 shadow-[0_8px_20px_-12px_rgba(0,87,184,0.55)] transition-colors duration-300 hover:bg-primary/[0.03] motion-safe:animate-pop-in";

  return (
    <>
      {/* Laptops (1024–1279px): one compact button. */}
      <button type="button" onClick={() => open("where")} className={cn(shell, "gap-2 pl-4 text-sm font-semibold text-ink lg:flex xl:hidden")}>
        {search.location || t("compactLabel")}
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-white" aria-hidden="true">
          <Search className="size-4" />
        </span>
      </button>

      {/* 1280px and up: the three parts. */}
      <div role="group" aria-label={t("compactLabel")} data-header-search className={cn(shell, "xl:flex")}>
        <button type="button" className={cn(part, "font-semibold text-ink")} onClick={() => open("where")}>
          {search.location || t("compactWhere")}
        </button>
        {search.mode === "short" && (
          <>
            <span className="h-5 w-px bg-line" aria-hidden="true" />
            <button type="button" className={cn(part, "font-semibold text-ink")} onClick={() => open("when")}>
              {whenSummary ?? t("compactWhen")}
            </button>
            <span className="h-5 w-px bg-line" aria-hidden="true" />
            <button type="button" className={cn(part, whoSummary ? "font-semibold text-ink" : "text-muted")} onClick={() => open("who")}>
              {whoSummary ?? t("whoPlaceholder")}
            </button>
          </>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => open("where")}
          className="ml-1 flex size-8 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary-hover"
        >
          <Search className="size-4" />
        </button>
      </div>

      {/* Pages without a hero: the full search floats over the whole page, which blurs and dims behind it.
          Portalled to <body>: the header's own backdrop-filter would otherwise trap these fixed layers inside it. */}
      {openPanel &&
        createPortal(
        <>
          <div
            data-testid="search-backdrop"
            data-closing={closing}
            aria-hidden="true"
            onClick={closeDropdown}
            className={cn(
              "fixed inset-0 z-[45] bg-[#00142e]/30 backdrop-blur-[10px]",
              closing ? "motion-safe:animate-[backdrop-out_320ms_ease-in_forwards]" : "motion-safe:animate-[backdrop-in_450ms_cubic-bezier(0.25,0.8,0.25,1)]",
            )}
          />
          <div
            className={cn(
              "pointer-events-none fixed inset-x-0 top-[88px] z-50 flex justify-center px-6 [&>*]:pointer-events-auto",
              closing ? "motion-safe:animate-[search-out_320ms_ease-in_forwards]" : "motion-safe:animate-[search-in_550ms_cubic-bezier(0.25,0.8,0.25,1)]",
            )}
          >
            <SearchBar today={today} initialOpen={openPanel} onClose={closeDropdown} blurPage={false} />
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
