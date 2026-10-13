import { Star } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { FavoriteButton } from "@/features/favorites/components/FavoriteButton";
import { isGuestFavorite } from "@/features/home/sections";
import { discountedPrice, headlineRate } from "@/features/listings/pricing";
import type { ListingCardData } from "@/features/listings/service";
import type { SearchMode } from "@/features/search/params";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";

/** Nights priced on short-stay cards ("RWF 100,000 for 2 nights"), as on the big travel sites. */
const SAMPLE_NIGHTS = 2;

const bold = (chunks: ReactNode) => <span className="font-semibold text-ink">{chunks}</span>;

/** Square-photo card for the home page rows and the favorites page. */
export function CompactListingCard({
  listing,
  mode,
  signedIn,
  saved,
}: {
  listing: ListingCardData;
  mode: SearchMode;
  signedIn: boolean;
  saved: boolean;
}) {
  const t = useTranslations("Listings");
  const tType = useTranslations("ListingType");
  const locale = useLocale();
  const cover = listing.photos[0];
  const rate = headlineRate(listing.rates, mode) ?? listing.rates[0];

  let price: ReactNode = null;
  if (rate) {
    const amount = discountedPrice(rate.price, listing.discountPercent);
    if (rate.unit === "NIGHT") price = t.rich("forNights", { price: formatRWF(amount * SAMPLE_NIGHTS, locale), count: SAMPLE_NIGHTS, b: bold });
    else if (rate.unit === "MONTH") price = t.rich("perMonthShort", { price: formatRWF(amount, locale), b: bold });
    else price = <>{bold(formatRWF(amount, locale))} {t(`perUnit.${rate.unit}`)}</>;
  }

  return (
    <div className="group relative">
      <Link
        href={`/listings/${listing.id}`}
        className="flex flex-col gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-canvas shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-black/[0.04] transition-shadow duration-500 group-hover:shadow-[0_14px_30px_-12px_rgba(16,24,40,0.35)]">
          {cover && (
            <Image
              src={cover.url}
              alt={t("photoAlt", { title: listing.title, number: 1 })}
              fill
              sizes="(min-width: 1280px) 17vw, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 45vw"
              // text-transparent hides the alt text if the photo fails to load.
              className="object-cover text-transparent transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06] motion-reduce:transition-none"
            />
          )}
          {/* Soft top shade keeps the white heart and badge readable on bright photos. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/20 to-transparent" aria-hidden="true" />
          {isGuestFavorite(listing) && (
            <span className="absolute top-3 left-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold tracking-[0.01em] text-ink shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
              {t("guestFavorite")}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5 px-0.5 tabular-nums">
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-[15px] leading-5 font-semibold tracking-[-0.01em] text-ink">
              {t("typeIn", { type: tType(listing.type), city: listing.city })}
            </h3>
            {listing.ratingCount > 0 && (
              <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium text-ink" aria-label={t("rating", { rating: listing.ratingAvg })}>
                <Star className="size-3 fill-current" aria-hidden="true" />
                <span aria-hidden="true">{listing.ratingAvg.toFixed(2)}</span>
              </span>
            )}
          </div>
          <p className="truncate text-sm leading-5 text-muted">{listing.title}</p>
          {price && <p className="mt-0.5 truncate text-sm leading-5 text-muted">{price}</p>}
        </div>
      </Link>
      <FavoriteButton
        listingId={listing.id}
        title={listing.title}
        initialSaved={saved}
        signedIn={signedIn}
        className="absolute top-2 right-2"
      />
    </div>
  );
}
