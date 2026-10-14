import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { HeroVideo } from "@/features/home/components/HeroVideo";
import { savedListingIds } from "@/features/favorites/service";
import { CompactListingCard } from "@/features/home/components/CompactListingCard";
import { HomeRow } from "@/features/home/components/HomeRow";
import { buildHomeSections, type HomeSectionKey } from "@/features/home/sections";
import type { PlaceType } from "@/features/search/params";
import { EmptyState } from "@/components/ui/EmptyState";
import { PendingArea, RowsSkeleton } from "@/components/ui/Skeletons";
import { House } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { RecentlyViewedRow } from "@/features/listings/components/RecentlyViewed";
import { OnboardingGate } from "@/features/onboarding/components/OnboardingGate";
import { featuredListings } from "@/features/listings/service";
import { HERO_SEARCH_ID, SearchBar } from "@/features/search/components/SearchBar";
import { getCurrentUser } from "@/lib/session";

// Modern villa (Unsplash, free license), served at up to 3840px for sharp large/retina screens.
const HERO_PHOTO = "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=3840&q=90";
// Looping drone shot of a modern house (Mixkit free stock video). Override with your own hosted file.
const HERO_VIDEO = process.env.NEXT_PUBLIC_HERO_VIDEO_URL || "https://assets.mixkit.co/videos/27543/27543-720.mp4";
// Newest homes the rows are built from (each row shows up to 10).
const ROW_POOL = 80;

const ROWS = {
  kigali: { title: "rowKigali", subtitle: "rowKigaliSub" },
  volcanoes: { title: "rowVolcanoes", subtitle: "rowVolcanoesSub" },
  kivu: { title: "rowKivu", subtitle: "rowKivuSub" },
  long: { title: "rowLong", subtitle: "rowLongSub" },
} as const satisfies Record<HomeSectionKey, { title: string; subtitle: string }>;

/** Home page body: hero search and rows of homes by destination. Also the backdrop for direct /login, /signup visits. */
export async function HomeContent({ onboarding = true, type = null }: { onboarding?: boolean; type?: PlaceType | null }) {
  const [t, tListings, pool, user] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Listings"),
    featuredListings(ROW_POOL),
    getCurrentUser(),
  ]);
  // Category chips (phones) filter the rows right here, without leaving the page.
  const sections = buildHomeSections(type ? pool.filter((listing) => listing.type === type) : pool);
  const saved = user ? await savedListingIds(user.id, pool.map((l) => l.id)) : new Set<string>();
  return (
    <>
      {onboarding && <OnboardingGate />}
      {/* md:-mt-[73px] (72px header + 1px border) tucks the hero under the transparent sticky header; the extra top padding keeps content clear of it. */}
      {/* Visually hidden: the search is the hero, but the page still needs a heading for screen readers and SEO. */}
      <h1 className="sr-only">
        {t("titleTop")} {t("titleBottom")}
      </h1>
      {/* Phones use the sticky "Start your search" pill instead of the hero. */}
      <section className="relative hidden md:-mt-[73px] md:block md:bg-primary">
        {/* Desktop hero: sharp photo under a brand-blue gradient (phones keep the clean white design). */}
        <div className="absolute inset-0 hidden overflow-hidden md:block" aria-hidden="true">
          {/* Footage graded to "pop" through the blue: a little more colour, contrast and light. */}
          <Image
            src={HERO_PHOTO}
            alt=""
            fill
            priority
            quality={90}
            sizes="100vw"
            className="object-cover object-center [filter:saturate(1.3)_contrast(1.12)_brightness(1.12)]"
          />
          <HeroVideo src={HERO_VIDEO} className="[filter:saturate(1.35)_contrast(1.15)_brightness(1.18)]" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/72 via-primary/48 to-[#00214a]/72" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,20,50,0.28)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#00214a]/40" />
          {/* Fine grain dithers the blue gradients so they stay smooth (no banding) on high-end displays. */}
          <div
            className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
        </div>
        <PageContainer className="relative flex flex-col gap-8 md:items-center md:pt-44 md:pb-28">
          <SearchBar id={HERO_SEARCH_ID} />
        </PageContainer>
      </section>
      <PendingArea
        skeleton={
          <PageContainer className="pt-4 pb-8 md:py-14">
            <RowsSkeleton />
          </PageContainer>
        }
      >
      {type && sections.length === 0 && (
        <PageContainer className="motion-safe:animate-pop-in">
          <EmptyState
            icon={<House />}
            title={t("noTypeTitle")}
            body={t("noTypeBody")}
            action={
              <Link href="/" scroll={false} className="inline-flex items-center rounded-xl bg-primary px-7 py-3 text-[15px] font-semibold text-white">
                {t("catAll")}
              </Link>
            }
          />
        </PageContainer>
      )}
      {sections.length > 0 && (
        // Keyed by category: switching chips fades the new rows in.
        <PageContainer key={type ?? "all"} className="flex flex-col gap-9 pt-4 pb-8 motion-safe:animate-pop-in md:gap-12 md:py-14">
          {!type && <RecentlyViewedRow />}
          {sections.map((section) => {
            const { title, subtitle } = ROWS[section.key];
            return (
              <HomeRow
                key={section.key}
                title={tListings(title)}
                subtitle={tListings(subtitle)}
                query={section.query}
              >
                {section.listings.map((listing) => (
                  <CompactListingCard
                    key={listing.id}
                    listing={listing}
                    mode={section.mode}
                    signedIn={user !== null}
                    saved={saved.has(listing.id)}
                  />
                ))}
              </HomeRow>
            );
          })}
        </PageContainer>
      )}
      </PendingArea>
    </>
  );
}
