import { Star } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { headlineRate, isNewListing } from "@/features/listings/pricing";
import type { ListingCardData } from "@/features/listings/service";
import type { SearchMode } from "@/features/search/params";
import { Link } from "@/i18n/navigation";
import { PriceTag } from "./PriceTag";

export function ListingCard({ listing, mode, priority = false }: { listing: ListingCardData; mode: SearchMode; priority?: boolean }) {
  const t = useTranslations("Listings");
  const cover = listing.photos[0];
  const rate = headlineRate(listing.rates, mode) ?? listing.rates[0];

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-card bg-surface shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
    >
      <div className="relative aspect-[3/2] bg-canvas">
        {cover && (
          <Image
            src={cover.url}
            alt={t("photoAlt", { title: listing.title, number: 1 })}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-3">
          <h3 className="flex-1 text-base font-semibold leading-snug text-ink">{listing.title}</h3>
          {listing.ratingCount > 0 ? (
            <span className="flex shrink-0 items-center gap-1 text-sm" aria-label={t("rating", { rating: listing.ratingAvg })}>
              <Star className="size-4 fill-ink" aria-hidden="true" />
              <span aria-hidden="true">{listing.ratingAvg.toFixed(1)}</span>
            </span>
          ) : (
            isNewListing(listing.publishedAt) && (
              <span className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-xs">{t("new")}</span>
            )
          )}
        </div>
        <p className="text-sm text-muted">
          {listing.district}, {listing.city}
        </p>
        {rate && <PriceTag rate={rate} discountPercent={listing.discountPercent} className="mt-auto" />}
      </div>
    </Link>
  );
}
