import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";
import { PageContainer } from "@/components/ui/PageContainer";
import { OnboardingGate } from "@/features/onboarding/components/OnboardingGate";
import { ListingGrid } from "@/features/listings/components/ListingGrid";
import { featuredListings } from "@/features/listings/service";
import { HomeSearch } from "@/features/search/components/HomeSearch";
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
          <h1 className="mt-16 text-3xl leading-tight md:mt-0 md:text-center md:text-5xl md:text-white">
            <span className="block font-bold">{t("titleTop")}</span>
            <span className="block">{t("titleBottom")}</span>
          </h1>
          <HomeSearch />
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
