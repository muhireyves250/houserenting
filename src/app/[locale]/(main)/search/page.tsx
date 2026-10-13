import { Building2, SlidersHorizontal } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { savedListingIds } from "@/features/favorites/service";
import { searchListings } from "@/features/listings/service";
import { FilterBar } from "@/features/search/components/FilterBar";
import { SearchResults } from "@/features/search/components/SearchResults";
import { SearchStateSync } from "@/features/search/components/SearchStateSync";
import { buildSearchQuery, parseSearchParams } from "@/features/search/params";
import { getCurrentUser } from "@/lib/session";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseSearchParams(await searchParams);
  const [listings, user, t, tHome, tListings] = await Promise.all([
    searchListings(query),
    getCurrentUser(),
    getTranslations("Search"),
    getTranslations("Home"),
    getTranslations("Listings"),
  ]);
  const saved = user ? await savedListingIds(user.id, listings.map((l) => l.id)) : new Set<string>();
  // The rest of the search (mode, place, dates, guests); filters are layered on top of it.
  const base = buildSearchQuery(query.mode, {
    location: query.location,
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    guests: query.guests,
    pets: query.pets,
    flex: query.flex,
  });
  const filtered = Boolean(query.types?.length || query.minPrice || query.maxPrice);

  return (
    <>
      <SearchStateSync query={query} />
      {/* Filter bar: sticks under the 73px header (top of the screen on phones). Title and count on the left,
          filters centred; phones stack them in two rows (112px), tablets and up use one row (72px). */}
      <div className="sticky top-0 z-30 border-b border-line/70 bg-surface/90 backdrop-blur-md md:top-[73px]">
        <div className="mx-auto flex h-[112px] max-w-7xl flex-col justify-center gap-2.5 px-4 md:grid md:h-[72px] md:grid-cols-[1fr_auto_1fr] md:items-center md:gap-6 md:px-6">
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg leading-6 font-bold tracking-[-0.02em] text-ink">
              {t("title", { place: query.location ?? tHome("country") })}
            </h1>
            <p className="truncate text-[13px] text-muted">
              {tListings("results", { count: listings.length })} · {query.mode === "short" ? tHome("short") : tHome("long")}
            </p>
          </div>
          <div className="flex justify-center">
            <FilterBar base={base} mode={query.mode} filters={{ types: query.types, minPrice: query.minPrice, maxPrice: query.maxPrice }} />
          </div>
          {/* Balances the title column so the filters sit in the true centre. */}
          <div className="hidden md:block" aria-hidden="true" />
        </div>
      </div>

      <SearchResults
        listings={listings}
        mode={query.mode}
        signedIn={user !== null}
        savedIds={[...saved]}
        empty={
          filtered ? (
            <EmptyState icon={<SlidersHorizontal />} title={t("noFilterResults")} body={t("noFilterResultsBody")} />
          ) : (
            <EmptyState icon={<Building2 />} title={t("emptyTitle")} body={t("emptyBody")} />
          )
        }
      />
    </>
  );
}
