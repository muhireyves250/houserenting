"use client";

import { List, Map as MapIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { CompactListingCard } from "@/features/home/components/CompactListingCard";
import type { ListingCardData } from "@/features/listings/service";
import type { SearchMode } from "@/features/search/params";
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
  header,
  empty,
}: {
  listings: ListingCardData[];
  mode: SearchMode;
  signedIn: boolean;
  savedIds: string[];
  /** Title and count, shown above the list. */
  header: ReactNode;
  empty: ReactNode;
}) {
  const t = useTranslations("Search");
  const [view, setView] = useState<"list" | "map">("list");
  // Which place is highlighted, and whether that came from the list (pin turns blue) or the map (card gets a frame).
  const [active, setActive] = useState<{ id: string; from: "list" | "map" } | null>(null);
  const saved = new Set(savedIds);

  return (
    // Desktop: list on the left half; the map is fixed to the right half of the screen (edge to edge,
    // under the 73px header + 72px filter bar), so it never moves while the list scrolls.
    <div data-results-map>
      <div className={cn("px-4 pt-6 pb-10 md:px-6 md:pt-8 lg:w-1/2 lg:pr-8", view === "map" && "hidden lg:block")}>
        {header}
        {listings.length === 0 ? (
          empty
        ) : (
          <ul className="grid grid-cols-1 gap-x-5 gap-y-6 min-[480px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 2xl:grid-cols-3">
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

      {/* Phones: the whole screen between the filter bar (72px) and the tab bar (64px) when toggled. */}
      <div
        className={cn(
          "h-[calc(100dvh-72px-64px)] lg:fixed lg:top-[calc(73px+72px)] lg:right-0 lg:bottom-0 lg:h-auto lg:w-1/2 lg:border-l lg:border-line/70",
          view === "list" && "hidden lg:block",
        )}
      >
        <ResultsMap
          listings={listings}
          mode={mode}
          activeId={active?.id ?? null}
          onActive={(id) => setActive(id ? { id, from: "map" } : null)}
          visibleKey={view}
        />
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
