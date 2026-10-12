import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";
import { PageContainer } from "@/components/ui/PageContainer";
import { OnboardingGate } from "@/features/onboarding/components/OnboardingGate";
import { ListingGrid } from "@/features/listings/components/ListingGrid";
import { featuredListings } from "@/features/listings/service";
import { SearchBar } from "@/features/search/components/SearchBar";
import { Link } from "@/i18n/navigation";

export default async function HomePage() {
  const [t, tListings, featured] = await Promise.all([getTranslations("Home"), getTranslations("Listings"), featuredListings(6)]);
  return (
    <>
      <OnboardingGate />
      <section className="md:bg-primary md:bg-[radial-gradient(circle_at_20%_20%,#1f6fd1_0,transparent_50%),radial-gradient(circle_at_80%_80%,#003f86_0,transparent_45%)]">
        <PageContainer className="flex flex-col gap-8 pt-6 pb-10 md:items-center md:py-28">
          <div className="flex justify-end md:hidden">
            <Suspense>
              <LocaleSwitcher />
            </Suspense>
          </div>
          {/* Visually hidden: the search bar is the hero, but the page still needs a heading for screen readers and SEO. */}
          <h1 className="sr-only">
            {t("titleTop")} {t("titleBottom")}
          </h1>
          <SearchBar />
        </PageContainer>
      </section>
      {featured.length > 0 && (
        <PageContainer className="py-10">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold md:text-2xl">{tListings("featured")}</h2>
            <Link href="/search" className="text-sm font-medium text-primary underline">
              {tListings("seeAll")}
            </Link>
          </div>
          <ListingGrid listings={featured} mode="short" />
        </PageContainer>
      )}
    </>
  );
}
