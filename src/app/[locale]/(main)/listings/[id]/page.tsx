import { BedDouble, ChevronLeft, MapPin, Ruler, Star, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PageContainer } from "@/components/ui/PageContainer";
import { ListingGallery } from "@/features/listings/components/ListingGallery";
import { PriceTag } from "@/features/listings/components/PriceTag";
import { rentalModes } from "@/features/listings/pricing";
import { getPublishedListing } from "@/features/listings/service";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ id: string }> };

const UNIT_ORDER = ["HOUR", "DAY", "NIGHT", "MONTH"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await getPublishedListing((await params).id);
  return listing ? { title: listing.title, description: listing.description.slice(0, 160) } : {};
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export default async function ListingPage({ params }: Props) {
  const listing = await getPublishedListing((await params).id);
  if (!listing) notFound();

  const [t, tFacility, tType] = await Promise.all([
    getTranslations("Listings"),
    getTranslations("Facility"),
    getTranslations("ListingType"),
  ]);
  const modes = rentalModes(listing.rates);
  const rates = [...listing.rates].sort((a, b) => UNIT_ORDER.indexOf(a.unit) - UNIT_ORDER.indexOf(b.unit));
  const tags = [
    { icon: <BedDouble />, label: t("rooms", { count: listing.rooms }) },
    { icon: <Ruler />, label: t("size", { size: listing.sizeM2 }) },
    { icon: <Users />, label: t("guests", { count: listing.maxGuests }) },
    ...(listing.depositMonths ? [{ icon: <Wallet />, label: t("deposit", { months: listing.depositMonths }) }] : []),
  ];

  const actions = (
    <div className="flex flex-col gap-2">
      {modes.short && (
        <Button size="lg" fullWidth disabled>
          {t("book")}
        </Button>
      )}
      {modes.long && (
        <Button size="lg" fullWidth disabled variant={modes.short ? "outline" : "primary"}>
          {t("applyViewing")}
        </Button>
      )}
      <p className="text-center text-xs text-muted">{t("bookingSoon")}</p>
    </div>
  );

  return (
    <PageContainer className="pt-0 pb-40 md:py-6">
      <Link href="/search" className="mb-4 hidden items-center gap-1 text-sm text-muted hover:text-ink md:inline-flex">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>

      <ListingGallery title={listing.title} photos={listing.photos} />

      <div className="mt-6 grid gap-10 md:grid-cols-[1fr_360px]">
        <div>
          <p className="text-sm text-muted">{tType(listing.type)}</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight md:text-3xl">{listing.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1 text-primary">
              <MapPin className="size-4" aria-hidden="true" />
              {listing.district}, {listing.city}
            </span>
            {listing.ratingCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="size-4 fill-ink" aria-hidden="true" />
                {listing.ratingAvg.toFixed(1)} · <span className="underline">{t("reviews", { count: listing.ratingCount })}</span>
              </span>
            )}
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag.label} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs [&>svg]:size-3.5">
                {tag.icon}
                {tag.label}
              </li>
            ))}
          </ul>

          <div className="py-6">
            <h2 className="mb-2 text-lg font-semibold">{t("description")}</h2>
            <p className="text-sm leading-relaxed whitespace-pre-line text-ink">{listing.description}</p>
          </div>

          {listing.characteristics.length > 0 && (
            <Section title={t("characteristics")}>
              <BulletList items={listing.characteristics} />
            </Section>
          )}
          {listing.facilities.length > 0 && (
            <Section title={t("facilities")}>
              <BulletList items={listing.facilities.map((f) => tFacility(f))} />
            </Section>
          )}
          {listing.termsOfRent.length > 0 && (
            <Section title={t("terms")}>
              <BulletList items={listing.termsOfRent} />
            </Section>
          )}
          <Section title={t("location")}>
            <p className="text-sm">
              {listing.addressLine}
              <br />
              {listing.district}, {listing.city}, Rwanda
            </p>
          </Section>
          <Section title={t("host")}>
            <div className="flex items-center gap-3">
              <Avatar name={listing.host.name} className="size-12" />
              <div>
                <p className="font-medium">{listing.host.name}</p>
                <p className="text-sm text-muted">{t("hostSince", { year: listing.host.createdAt.getFullYear() })}</p>
              </div>
            </div>
          </Section>
        </div>

        <aside className="md:sticky md:top-24 md:self-start">
          <div className="rounded-card bg-surface p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">{t("prices")}</h2>
            <ul className="mb-5 flex flex-col gap-4">
              {rates.map((rate) => (
                <li key={rate.id} className="flex flex-col gap-1">
                  <span className="text-xs font-medium tracking-wide text-muted uppercase">{t(`unitName.${rate.unit}`)}</span>
                  <PriceTag rate={rate} discountPercent={listing.discountPercent} />
                  {rate.unit === "NIGHT" && rate.checkInTime && rate.checkOutTime && (
                    <span className="text-xs text-muted">
                      {t("checkIn", { time: rate.checkInTime })} · {t("checkOut", { time: rate.checkOutTime })}
                    </span>
                  )}
                  {(rate.unit === "DAY" || rate.unit === "HOUR") && rate.dayStartTime && rate.dayEndTime && (
                    <span className="text-xs text-muted">{t("openHours", { start: rate.dayStartTime, end: rate.dayEndTime })}</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="hidden md:block">{actions}</div>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(57px+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface p-4 md:hidden">
        {actions}
      </div>
    </PageContainer>
  );
}
