"use client";

import { LoaderCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { CompactListingCard } from "@/features/home/components/CompactListingCard";
import type { ListingCardData } from "@/features/listings/service";
import { formatBbox, type Bbox, type SearchMode } from "@/features/search/params";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { ListSkeleton, PendingArea } from "@/components/ui/Skeletons";

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
  countLabel,
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
  /** "7 homes", shown on the phone list sheet. */
  countLabel?: string;
  empty: ReactNode;
}) {
  const t = useTranslations("Search");
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
    // Desktop: list on the left half, map on the right half, held in place (sticky) under the 73px header + 72px
    // filter bar. Phones and tablets: the map sits at the top (sticky) and the list slides up over it as a sheet.
    <div className="mx-auto flex max-w-7xl flex-col px-4 md:px-6 lg:grid lg:grid-cols-2 lg:gap-8">
      {/* At least a screen tall, so the sticky map always has room and never slides under the filter bar. */}
      <div
        className={cn(
          "relative z-10 -mx-4 -mt-6 rounded-t-[28px] bg-canvas px-4 pt-3 pb-10 shadow-[0_-10px_30px_-12px_rgba(16,24,40,0.3)] md:-mx-6 md:px-6",
          "lg:mx-0 lg:mt-0 lg:min-h-[calc(100dvh-145px)] lg:rounded-none lg:px-0 lg:pt-6 lg:shadow-none",
        )}
      >
        <div className="mb-5 flex flex-col items-center gap-3 lg:hidden">
          <span className="h-1.5 w-10 rounded-full bg-line-strong" aria-hidden="true" />
          {countLabel && <p className="text-[15px] font-semibold text-ink">{countLabel}</p>}
        </div>
        <PendingArea skeleton={<ListSkeleton />} pending={updating}>
          {listings.length === 0 ? (
            empty
          ) : (
            <ul className="grid grid-cols-1 gap-x-5 gap-y-8 min-[480px]:grid-cols-2 md:gap-y-6">
              {listings.map((listing) => (
                <li
                  key={listing.id}
                  onMouseEnter={() => setActive({ id: listing.id, from: "list" })}
                  onMouseLeave={() => setActive(null)}
                  className={cn(
                    "scroll-reveal rounded-[22px] ring-2 ring-transparent transition-[box-shadow] duration-300",
                    active?.from === "map" && active.id === listing.id && "ring-primary/50",
                  )}
                >
                  <CompactListingCard listing={listing} mode={mode} signedIn={signedIn} saved={saved.has(listing.id)} layout="list" />
                </li>
              ))}
            </ul>
          )}
        </PendingArea>
      </div>

      {/* Phones: full-bleed under the 80px pill bar + 60px filter bar. Tablets: under the 73px header + 72px filters.
          Desktop: a rounded panel with a 24px gap above and below. */}
      <div
        className={cn(
          "relative order-first -mx-4 h-[44vh] overflow-hidden md:-mx-6",
          "sticky top-[132px] md:top-[145px]",
          "lg:order-none lg:mx-0 lg:mt-6 lg:h-[calc(100dvh-145px-48px)] lg:rounded-2xl lg:border lg:border-line/70 lg:shadow-[0_1px_3px_rgba(16,24,40,0.08)] lg:top-[calc(145px+24px)]",
        )}
      >
        <ResultsMap
          listings={listings}
          mode={mode}
          activeId={active?.id ?? null}
          onActive={(id) => setActive(id ? { id, from: "map" } : null)}
          visibleKey="map"
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
            className="absolute top-14 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white shadow-lg motion-safe:animate-pop-in lg:top-3"
          >
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {t("updating")}
          </p>
        )}
      </div>
    </div>
  );
}
