"use client";

import { List, LoaderCircle, Map as MapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { CompactListingCard } from "@/features/home/components/CompactListingCard";
import type { ListingCardData } from "@/features/listings/service";
import { formatBbox, type Bbox, type SearchMode } from "@/features/search/params";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

// MapLibre needs the browser (window, WebGL); load it client-side only.
const ResultsMap = dynamic(() => import("./ResultsMap").then((m) => m.ResultsMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#eceef1]" />,
});

/**
 * Results list beside a sticky map (desktop), or one at a time with a floating Map / List toggle (phones).
 * Hovering a card highlights its pin, and hovering a pin highlights its card.
 */
export function SearchResults({
  listings,
  mode,
  signedIn,
  savedIds,
  query,
  bbox,
  empty,
}: {
  listings: ListingCardData[];
  mode: SearchMode;
  signedIn: boolean;
  savedIds: string[];
  /** The current search as URL params (without bbox); moving the map searches its area on top of these. */
  query: Record<string, string>;
  /** Map area the results are limited to, when the map is being used as the filter. */
  bbox?: Bbox;
  empty: ReactNode;
}) {
  const t = useTranslations("Search");
  const [view, setView] = useState<"list" | "map">("list");
  // Which place is highlighted, and whether that came from the list (pin turns blue) or the map (card gets a frame).
  const [active, setActive] = useState<{ id: string; from: "list" | "map" } | null>(null);
  const saved = new Set(savedIds);
  const router = useRouter();
  const [updating, startUpdate] = useTransition();
  // "Search as I move the map": moving the map replaces the typed place with the visible area.
  const [followMap, setFollowMap] = useState(true);

  function searchArea(area: Bbox) {
    if (!followMap) return;
    const next: Record<string, string> = { ...query, bbox: formatBbox(area) };
    delete next.location;
    startUpdate(() => router.replace({ pathname: "/search", query: next }, { scroll: false }));
  }

  return (
    // Same width and side margins as the header. Desktop: list on the left half, map on the right half,
    // held in place (sticky) under the 73px header + 72px filter bar while the list scrolls.
    <div className="mx-auto max-w-7xl px-4 md:px-6 lg:grid lg:grid-cols-2 lg:gap-8">
      {/* At least a screen tall, so the sticky map always has room and never slides under the filter bar. */}
      <div className={cn("pt-6 pb-10 lg:min-h-[calc(100dvh-145px)]", view === "map" && "hidden lg:block")}>
        {listings.length === 0 ? (
          empty
        ) : (
          <ul className="grid grid-cols-1 gap-x-5 gap-y-6 min-[480px]:grid-cols-2">
            {listings.map((listing) => (
              <li
                key={listing.id}
                onMouseEnter={() => setActive({ id: listing.id, from: "list" })}
                onMouseLeave={() => setActive(null)}
                className={cn(
                  "rounded-[22px] ring-2 ring-transparent transition-[box-shadow] duration-300",
                  active?.from === "map" && active.id === listing.id && "ring-primary/50",
                )}
              >
                <CompactListingCard listing={listing} mode={mode} signedIn={signedIn} saved={saved.has(listing.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 24px gap above and below the map on desktop; on phones it fills the space between the filter bar (112px) and tab bar. */}
      <div
        className={cn(
          "relative mt-4 h-[calc(100dvh-112px-64px-32px)] md:h-[calc(100dvh-73px-72px-48px)] overflow-hidden rounded-2xl border border-line/70 shadow-[0_1px_3px_rgba(16,24,40,0.08)]",
          "lg:sticky lg:top-[calc(145px+24px)] lg:mt-6 lg:h-[calc(100dvh-145px-48px)]",
          view === "list" && "hidden lg:block",
        )}
      >
        <ResultsMap
          listings={listings}
          mode={mode}
          activeId={active?.id ?? null}
          onActive={(id) => setActive(id ? { id, from: "map" } : null)}
          visibleKey={view}
          bbox={bbox}
          onBoundsChange={searchArea}
        />
        <label className="absolute top-3 left-3 z-10 inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-surface py-2 pr-4 pl-3 text-[13px] font-semibold text-ink shadow-[0_4px_14px_rgba(16,24,40,0.18)] select-none">
          <input
            type="checkbox"
            checked={followMap}
            onChange={(event) => setFollowMap(event.target.checked)}
            className="size-4 cursor-pointer accent-[var(--color-primary)]"
          />
          {t("searchAsMove")}
        </label>
        {updating && (
          <p
            role="status"
            className="absolute top-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white shadow-lg motion-safe:animate-pop-in max-lg:top-16"
          >
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {t("updating")}
          </p>
        )}
      </div>

      {/* Phones: Airbnb-style floating toggle above the tab bar. */}
      <button
        type="button"
        onClick={() => setView(view === "list" ? "map" : "list")}
        className="fixed bottom-24 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-8px_rgba(0,0,0,0.55)] transition-transform duration-300 active:scale-95 lg:hidden"
      >
        {view === "list" ? t("showMap") : t("showList")}
        {view === "list" ? <MapIcon className="size-4" aria-hidden="true" /> : <List className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
