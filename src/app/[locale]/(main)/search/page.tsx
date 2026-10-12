import { Building2, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { ListingGrid } from "@/features/listings/components/ListingGrid";
import { searchListings } from "@/features/listings/service";
import { parseSearchParams } from "@/features/search/params";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseSearchParams(await searchParams);
  const [listings, t, tHome, tListings] = await Promise.all([
    searchListings(query),
    getTranslations("Search"),
    getTranslations("Home"),
    getTranslations("Listings"),
  ]);

  return (
    <PageContainer className="py-6">
      <div className="mb-6 flex items-center gap-2 border-b border-line pb-3">
        <MapPin className="size-5" aria-hidden="true" />
        <h1 className="font-medium">{query.location ?? t("anywhere")}</h1>
        <span className="text-sm text-muted">· {tListings("results", { count: listings.length })}</span>
        <span className="ml-auto rounded-full bg-surface px-3 py-1 text-xs">{query.mode === "short" ? tHome("short") : tHome("long")}</span>
      </div>
      {listings.length > 0 ? (
        <ListingGrid listings={listings} mode={query.mode} />
      ) : (
        <EmptyState icon={<Building2 />} title={t("emptyTitle")} body={t("emptyBody")} />
      )}
    </PageContainer>
  );
}
