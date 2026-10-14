import {
  AirVent,
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  CookingPot,
  KeyRound,
  Laptop,
  type LucideIcon,
  Microwave,
  PawPrint,
  ShieldCheck,
  ShowerHead,
  SquareParking,
  Star,
  Tv,
  Utensils,
  WashingMachine,
  WavesLadder,
  Wifi,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { PageContainer } from "@/components/ui/PageContainer";
import { savedListingIds } from "@/features/favorites/service";
import { isGuestFavorite } from "@/features/home/sections";
import { BookingCard, MobileBookingBar, StayCalendar, StayProvider } from "@/features/listings/components/detail/Booking";
import { TrackView } from "@/features/listings/components/RecentlyViewed";
import { ListingPhotos } from "@/features/listings/components/detail/ListingPhotos";
import { LocationMapLazy } from "@/features/listings/components/detail/LocationMapLazy";
import { SaveButton } from "@/features/listings/components/detail/SaveButton";
import { ShareButton } from "@/features/listings/components/detail/ShareButton";
import { discountedPrice } from "@/features/listings/pricing";
import { getPublishedListing, nearbyListings } from "@/features/listings/service";
import { bookedRanges } from "@/features/bookings/service";
import { getEnv } from "@/lib/env";
import { CollapsibleText } from "@/features/listings/components/detail/CollapsibleText";
import { CompactListingCard } from "@/features/home/components/CompactListingCard";
import { HomeRow } from "@/features/home/components/HomeRow";
import { navHref } from "@/components/shell/nav-items";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

const UNIT_ORDER = ["HOUR", "DAY", "NIGHT", "MONTH"] as const;

const FACILITY_ICONS: Record<string, LucideIcon> = {
  KITCHEN: CookingPot,
  WIFI: Wifi,
  AIR_CONDITIONER: AirVent,
  WORKPLACE: Laptop,
  WASHING_MACHINE: WashingMachine,
  DISHWASHER: Utensils,
  OVEN: CookingPot,
  MICROWAVE: Microwave,
  PARKING: SquareParking,
  TV: Tv,
  HOT_WATER: ShowerHead,
  SECURITY: ShieldCheck,
  GENERATOR: Zap,
  POOL: WavesLadder,
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await getPublishedListing((await params).id);
  return listing ? { title: listing.title, description: listing.description.slice(0, 160) } : {};
}

function Section({ title, children, id }: { title?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-reveal border-t border-line py-10">
      {title && <h2 className="mb-6 font-display text-[22px] leading-7 font-bold tracking-[-0.02em] text-ink">{title}</h2>}
      {children}
    </section>
  );
}

export default async function ListingPage({ params }: Props) {
  const listing = await getPublishedListing((await params).id);
  if (!listing) notFound();

  const [t, tFacility, tType, user, locale] = await Promise.all([
    getTranslations("Listings"),
    getTranslations("Facility"),
    getTranslations("ListingType"),
    getCurrentUser(),
    getLocale(),
  ]);
  const [nearby, booked] = await Promise.all([nearbyListings(listing), bookedRanges(listing.id)]);
  const savedIds = user ? await savedListingIds(user.id, [listing.id, ...nearby.map((l) => l.id)]) : new Set<string>();
  const saved = savedIds.has(listing.id);
  const rates = [...listing.rates].sort((a, b) => UNIT_ORDER.indexOf(a.unit) - UNIT_ORDER.indexOf(b.unit));
  const night = rates.find((r) => r.unit === "NIGHT");
  const place = `${listing.district}, ${listing.city}`;

  const stats = [
    t("statGuests", { count: listing.maxGuests }),
    t("statBedrooms", { count: listing.bedrooms }),
    t("statBaths", { count: listing.bathrooms }),
    t("size", { size: listing.sizeM2 }),
  ];

  // Up to three highlights the data can honestly back.
  const highlights = [
    listing.facilities.includes("POOL") && { icon: WavesLadder, title: t("highlightPool"), body: t("highlightPoolBody") },
    listing.facilities.includes("PARKING") && { icon: SquareParking, title: t("highlightParking"), body: t("highlightParkingBody") },
    listing.facilities.includes("WORKPLACE") && { icon: Laptop, title: t("highlightWorkspace"), body: t("highlightWorkspaceBody") },
    listing.petsAllowed && { icon: PawPrint, title: t("highlightPets"), body: t("highlightPetsBody") },
  ]
    .filter((h): h is { icon: LucideIcon; title: string; body: string } => Boolean(h))
    .slice(0, 3);

  // Share / Save windows show the place: cover, name, and "Room in Gasabo, Kigali · ★ 4.50".
  const preview = {
    title: listing.title,
    subtitle: [t("typeInPlace", { type: tType(listing.type), place }), listing.ratingCount > 0 && `★ ${listing.ratingAvg.toFixed(2)}`]
      .filter(Boolean)
      .join(" · "),
    photo: listing.photos[0]?.url ?? null,
  };
  const actions = (
    <>
      <ShareButton {...preview} />
      <SaveButton listingId={listing.id} initialSaved={saved} signedIn={user !== null} {...preview} />
    </>
  );

  // House rules, without repeats (hosts often also write the check-in time as a rule).
  const houseRules = [
    ...new Set(
      [
        night?.checkInTime && t("checkIn", { time: night.checkInTime }),
        night?.checkOutTime && t("checkOut", { time: night.checkOutTime }),
        t("maxGuests", { count: listing.maxGuests }),
        listing.petsAllowed ? t("petsAllowed") : t("noPets"),
        ...listing.termsOfRent,
      ].filter((rule): rule is string => Boolean(rule)),
    ),
  ];

  const bookingRates = rates.map(({ unit, price, checkInTime, checkOutTime, dayStartTime, dayEndTime }) => ({
    unit,
    price,
    checkInTime,
    checkOutTime,
    dayStartTime,
    dayEndTime,
  }));

  return (
    <StayProvider listingId={listing.id} booked={booked} holdMinutes={getEnv().BOOKING_HOLD_MINUTES}>
      <TrackView
        listing={{
          id: listing.id,
          title: listing.title,
          type: listing.type,
          city: listing.city,
          photo: listing.photos[0]?.url ?? null,
          bedrooms: listing.bedrooms,
          ratingAvg: listing.ratingAvg,
          ratingCount: listing.ratingCount,
        }}
      />
      <PageContainer className="pt-0 pb-40 md:pt-8 md:pb-16">
        {/* Title row */}
        <div className="mb-6 hidden items-end justify-between gap-6 md:flex">
          <div className="min-w-0">
            <Link href="/search" className="mb-2 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
              <ChevronLeft className="size-4" aria-hidden="true" />
              {t("back")}
            </Link>
            <h1 className="font-display text-[28px] leading-9 font-bold tracking-[-0.025em] text-ink">{listing.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
          </div>
        </div>

        <div className="relative">
          <ListingPhotos title={listing.title} photos={listing.photos} />
          {/* Phones: round back / share / save buttons over the photo. */}
          <div className="absolute inset-x-0 top-4 z-10 flex items-center justify-between md:hidden">
            <Link
              href="/search"
              aria-label={t("back")}
              className="flex size-10 items-center justify-center rounded-full bg-white/95 text-ink shadow-[0_4px_14px_rgba(0,0,0,0.25)] backdrop-blur transition-transform duration-200 active:scale-90"
            >
              <ArrowLeft className="size-[18px]" aria-hidden="true" />
            </Link>
            <div className="flex gap-3">
              <ShareButton variant="icon" {...preview} />
              <SaveButton variant="icon" listingId={listing.id} initialSaved={saved} signedIn={user !== null} {...preview} />
            </div>
          </div>
        </div>

        {/* Phones: the details sit on a rounded sheet that overlaps the photo. */}
        <div
          className={
            "relative z-[1] -mx-4 -mt-6 grid gap-x-16 rounded-t-[28px] bg-canvas px-4 pt-8 " +
            "md:mx-0 md:mt-10 md:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] md:rounded-none md:bg-transparent md:px-0 md:pt-0"
          }
        >
          <div className="min-w-0">
            {/* Summary */}
            <div className="pb-8 text-center md:text-left">
              <h1 className="mb-3 font-display text-[22px] leading-7 font-bold tracking-[-0.025em] md:hidden">{listing.title}</h1>
              <h2 className="text-[15px] font-semibold text-ink/80 md:font-display md:text-[22px] md:leading-7 md:font-bold md:tracking-[-0.02em] md:text-ink">
                {t("typeInPlace", { type: tType(listing.type), place })}
              </h2>
              <p className="mt-1 text-[15px] text-ink/80">{stats.join(" · ")}</p>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[15px] font-semibold text-ink md:justify-start">
                <Star className="size-4 fill-ink" aria-hidden="true" />
                {listing.ratingCount > 0 ? (
                  <>
                    {listing.ratingAvg.toFixed(2)} · <span className="underline underline-offset-4">{t("reviews", { count: listing.ratingCount })}</span>
                  </>
                ) : (
                  t("noReviews")
                )}
                {isGuestFavorite(listing) && (
                  <span className="ml-2 rounded-full bg-primary/[0.08] px-2.5 py-0.5 text-xs font-semibold text-primary">{t("guestFavorite")}</span>
                )}
              </p>
            </div>

            {/* Host */}
            <div className="flex items-center gap-4 border-t border-line py-6">
              <Avatar name={listing.host.name} className="size-12 text-base" />
              <div>
                <p className="text-[15px] font-semibold text-ink">{t("hostedBy", { name: listing.host.name })}</p>
                <p className="text-sm text-muted">{t("hostingSince", { year: listing.host.createdAt.getFullYear() })}</p>
              </div>
            </div>

            {highlights.length > 0 && (
              <ul className="flex flex-col gap-6 border-t border-line py-8">
                {highlights.map(({ icon: Icon, title, body }) => (
                  <li key={title} className="flex gap-5">
                    <Icon className="mt-0.5 size-6 shrink-0 text-ink" strokeWidth={1.6} aria-hidden="true" />
                    <div>
                      <p className="text-[15px] font-semibold text-ink">{title}</p>
                      <p className="text-sm text-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Section>
              <CollapsibleText text={listing.description} />
              {listing.characteristics.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {listing.characteristics.map((c) => (
                    <li key={c} className="rounded-full bg-surface px-3 py-1 text-[13px] font-medium text-ink/80 ring-1 ring-line/80">
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {listing.facilities.length > 0 && (
              <Section title={t("offers")}>
                <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {listing.facilities.map((facility) => {
                    const Icon = FACILITY_ICONS[facility] ?? ShieldCheck;
                    return (
                      <li key={facility} className="flex items-center gap-4 text-[15px] text-ink">
                        <Icon className="size-6 shrink-0" strokeWidth={1.6} aria-hidden="true" />
                        {tFacility(facility)}
                      </li>
                    );
                  })}
                </ul>
              </Section>
            )}

            {night && <StayCalendar city={listing.city} />}
          </div>

          <div className="hidden md:block">
            <div className="sticky top-[97px]">
              <BookingCard
                rates={bookingRates}
                discountPercent={listing.discountPercent}
                maxGuests={listing.maxGuests}
                place={preview}
                signedIn={user !== null}
              />
            </div>
          </div>
        </div>

        {/* Where you'll be */}
        <Section title={t("whereYoullBe")}>
          <p className="-mt-3 mb-5 text-[15px] text-ink">
            {listing.addressLine}, {place}, Rwanda
          </p>
          <div className="h-[clamp(300px,40vw,480px)] overflow-hidden rounded-2xl border border-line/70">
            <LocationMapLazy lat={listing.lat} lng={listing.lng} label={t("whereYoullBe")} />
          </div>
        </Section>

        {/* Meet your host */}
        <Section title={t("meetHost")}>
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-12">
            <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-3xl bg-surface px-8 py-8 shadow-[0_12px_36px_-14px_rgba(16,24,40,0.35)]">
              <Avatar name={listing.host.name} className="size-24 text-3xl" />
              <p className="mt-2 font-display text-[26px] font-bold tracking-[-0.02em] text-ink">{listing.host.name}</p>
              <p className="text-sm text-muted">{t("hostingSince", { year: listing.host.createdAt.getFullYear() })}</p>
            </div>
            <Link
              href={navHref("/chats", user !== null)}
              className="inline-flex w-fit items-center rounded-xl border border-ink/80 max-md:border-primary bg-surface px-6 py-3 text-[15px] font-semibold text-ink transition-[background-color,transform] duration-300 hover:bg-canvas active:scale-95"
            >
              {t("messageHost")}
            </Link>
          </div>
        </Section>

        {/* Things to know */}
        <Section title={t("thingsToKnow")}>
          <div className="grid gap-10 md:grid-cols-2 lg:max-w-4xl">
            <div>
              <KeyRound className="mb-4 size-6 text-ink" strokeWidth={1.6} aria-hidden="true" />
              <h3 className="mb-2 text-[15px] font-semibold text-ink">{t("houseRules")}</h3>
              <ul className="flex flex-col gap-1.5 text-[15px] text-ink/80">
                {houseRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
            <div>
              <CalendarClock className="mb-4 size-6 text-ink" strokeWidth={1.6} aria-hidden="true" />
              <h3 className="mb-2 text-[15px] font-semibold text-ink">{t("prices")}</h3>
              <ul className="flex flex-col gap-1.5 text-[15px] text-ink/80 tabular-nums">
                {rates.map((rate) => (
                  <li key={rate.id}>
                    {t(`unitName.${rate.unit}`)} · <b className="font-semibold text-ink">{formatRWF(discountedPrice(rate.price, listing.discountPercent), locale)}</b>{" "}
                    {t(`perUnit.${rate.unit}`)}
                    {rate.dayStartTime && rate.dayEndTime && (
                      <span className="block text-sm text-muted">{t("openHours", { start: rate.dayStartTime, end: rate.dayEndTime })}</span>
                    )}
                  </li>
                ))}
                {listing.depositMonths && <li>{t("deposit", { months: listing.depositMonths })}</li>}
              </ul>
            </div>
          </div>
        </Section>
        {nearby.length > 0 && (
          <section className="border-t border-line py-10">
            <HomeRow title={t("moreNearby")} subtitle={t("moreNearbySub")}>
              {nearby.map((home) => (
                <CompactListingCard
                  key={home.id}
                  listing={home}
                  mode={rates.some((r) => r.unit !== "MONTH") ? "short" : "long"}
                  signedIn={user !== null}
                  saved={savedIds.has(home.id)}
                />
              ))}
            </HomeRow>
          </section>
        )}
      </PageContainer>

      {rates.length > 0 && <MobileBookingBar rates={bookingRates} discountPercent={listing.discountPercent} place={preview} signedIn={user !== null} />}
    </StayProvider>
  );
}
