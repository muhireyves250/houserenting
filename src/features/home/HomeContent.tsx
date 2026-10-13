import { Building2, CalendarDays, Mountain, Waves } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";
import { PageContainer } from "@/components/ui/PageContainer";
import { HeroVideo } from "@/features/home/components/HeroVideo";
import { savedListingIds } from "@/features/favorites/service";
import { CompactListingCard } from "@/features/home/components/CompactListingCard";
import { HomeRow } from "@/features/home/components/HomeRow";
import { buildHomeSections, type HomeSectionKey } from "@/features/home/sections";
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
  kigali: { title: "rowKigali", subtitle: "rowKigaliSub", Icon: Building2 },
  volcanoes: { title: "rowVolcanoes", subtitle: "rowVolcanoesSub", Icon: Mountain },
  kivu: { title: "rowKivu", subtitle: "rowKivuSub", Icon: Waves },
  long: { title: "rowLong", subtitle: "rowLongSub", Icon: CalendarDays },
} as const satisfies Record<HomeSectionKey, { title: string; subtitle: string; Icon: unknown }>;

/** Home page body: hero search and rows of homes by destination. Also the backdrop for direct /login, /signup visits. */
export async function HomeContent({ onboarding = true }: { onboarding?: boolean }) {
  const [t, tListings, pool, user] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Listings"),
    featuredListings(ROW_POOL),
    getCurrentUser(),
  ]);
  const sections = buildHomeSections(pool);
  const saved = user ? await savedListingIds(user.id, pool.map((l) => l.id)) : new Set<string>();
  return (
    <>
      {onboarding && <OnboardingGate />}
      {/* md:-mt-[73px] (72px header + 1px border) tucks the hero under the transparent sticky header; the extra top padding keeps content clear of it. */}
      <section className="relative md:-mt-[73px] md:bg-primary">
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
        <PageContainer className="relative flex flex-col gap-8 pt-6 pb-10 md:items-center md:pt-44 md:pb-28">
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
      {sections.length > 0 && (
        <PageContainer className="flex flex-col gap-10 py-10 md:gap-12 md:py-14">
          {sections.map((section) => {
            const { title, subtitle, Icon } = ROWS[section.key];
            return (
              <HomeRow
                key={section.key}
                icon={<Icon strokeWidth={1.75} />}
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
    </>
  );
}
