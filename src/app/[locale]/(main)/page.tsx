import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";
import { PageContainer } from "@/components/ui/PageContainer";
import { HeroVideo } from "@/features/home/components/HeroVideo";
import { OnboardingGate } from "@/features/onboarding/components/OnboardingGate";
import { ListingGrid } from "@/features/listings/components/ListingGrid";
import { featuredListings } from "@/features/listings/service";
import { HERO_SEARCH_ID, SearchBar } from "@/features/search/components/SearchBar";
import { Link } from "@/i18n/navigation";

// Modern villa (Unsplash, free license), served at up to 3840px for sharp large/retina screens.
const HERO_PHOTO = "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=3840&q=90";
// Looping drone shot of a modern house (Mixkit free stock video). Override with your own hosted file.
const HERO_VIDEO = process.env.NEXT_PUBLIC_HERO_VIDEO_URL || "https://assets.mixkit.co/videos/27543/27543-720.mp4";

export default async function HomePage() {
  const [t, tListings, featured] = await Promise.all([getTranslations("Home"), getTranslations("Listings"), featuredListings(6)]);
  return (
    <>
      <OnboardingGate />
      <section className="relative md:bg-primary">
        {/* Desktop hero: sharp photo under a brand-blue gradient (phones keep the clean white design). */}
        <div className="absolute inset-0 hidden overflow-hidden md:block" aria-hidden="true">
          <Image src={HERO_PHOTO} alt="" fill priority quality={90} sizes="100vw" className="object-cover object-center" />
          <HeroVideo src={HERO_VIDEO} />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/55 to-[#00214a]/80" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,20,50,0.3)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#00214a]/40" />
        </div>
        <PageContainer className="relative flex flex-col gap-8 pt-6 pb-10 md:items-center md:py-36">
          <div className="flex justify-end md:hidden">
            <Suspense>
              <LocaleSwitcher />
            </Suspense>
          </div>
          {/* Visually hidden: the search bar is the hero, but the page still needs a heading for screen readers and SEO. */}
          <h1 className="sr-only">
            {t("titleTop")} {t("titleBottom")}
          </h1>
          <SearchBar id={HERO_SEARCH_ID} />
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
