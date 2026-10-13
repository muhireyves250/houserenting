import { Building2, SlidersHorizontal } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { savedListingIds } from "@/features/favorites/service";
import { searchListings } from "@/features/listings/service";
import { FilterBar } from "@/features/search/components/FilterBar";
import { SearchResults } from "@/features/search/components/SearchResults";
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
      {/* Filter bar: sticks under the 73px desktop header (top of the screen on phones). */}
      <div className="sticky top-0 z-30 border-b border-line/70 bg-surface/90 backdrop-blur-md md:top-[73px]">
        <div className="mx-auto flex h-[72px] max-w-[1760px] items-center gap-3 px-4 md:px-6">
          <SlidersHorizontal className="hidden size-4 text-muted sm:block" aria-hidden="true" />
          <FilterBar base={base} mode={query.mode} filters={{ types: query.types, minPrice: query.minPrice, maxPrice: query.maxPrice }} />
        </div>
      </div>

      <div className="mx-auto max-w-[1760px] px-4 pt-6 md:px-6 md:pt-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div>
            <h1 className="font-display text-[22px] leading-7 font-bold tracking-[-0.02em] text-ink md:text-[26px] md:leading-8">
              {t("title", { place: query.location ?? tHome("country") })}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {tListings("results", { count: listings.length })} · {query.mode === "short" ? tHome("short") : tHome("long")}
            </p>
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
      </div>
    </>
  );
}
