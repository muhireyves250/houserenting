import { MapPin, Star, Users } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { FavoriteButton } from "@/features/favorites/components/FavoriteButton";
import { isGuestFavorite } from "@/features/home/sections";
import { discountedPrice, headlineRate } from "@/features/listings/pricing";
import type { ListingCardData } from "@/features/listings/service";
import type { SearchMode } from "@/features/search/params";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";

/** Nights priced on short-stay cards ("RWF 100,000 for 2 nights"), as on the big travel sites. */
const SAMPLE_NIGHTS = 2;

const SIZES = "(min-width: 1280px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 40vw, 62vw";
const SLIDE_EASE = "ease-[cubic-bezier(0.22,1,0.36,1)]";

const bold = (chunks: ReactNode) => <span className="text-[15px] font-bold tracking-[-0.01em] text-ink">{chunks}</span>;

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
  const [cover, next] = listing.photos;
  const rate = headlineRate(listing.rates, mode) ?? listing.rates[0];

  let price: ReactNode = null;
  if (rate) {
    const amount = discountedPrice(rate.price, listing.discountPercent);
    if (rate.unit === "NIGHT") price = t.rich("forNights", { price: formatRWF(amount * SAMPLE_NIGHTS, locale), count: SAMPLE_NIGHTS, b: bold });
    else if (rate.unit === "MONTH") price = t.rich("perMonthShort", { price: formatRWF(amount, locale), b: bold });
    else price = <>{bold(formatRWF(amount, locale))} {t(`perUnit.${rate.unit}`)}</>;
  }

  return (
    <div className="group relative h-full">
      <Link
        href={`/listings/${listing.id}`}
        className={cn(
          "flex h-full flex-col rounded-[20px] border border-black/[0.06] bg-surface p-2 shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
          "transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_18px_36px_-16px_rgba(16,24,40,0.28)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        )}
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-canvas">
          {/* Hover slides the cover out to the left and the next photo in from the right (or zooms a lone cover). */}
          {cover && (
            <Image
              src={cover.url}
              alt={t("photoAlt", { title: listing.title, number: 1 })}
              fill
              sizes={SIZES}
              // text-transparent hides the alt text if the photo fails to load.
              className={cn(
                "object-cover text-transparent transition-transform duration-700 motion-reduce:transition-none",
                SLIDE_EASE,
                next ? "group-hover:-translate-x-full" : "group-hover:scale-[1.05]",
              )}
            />
          )}
          {next && (
            <Image
              src={next.url}
              alt=""
              data-slide="next"
              fill
              sizes={SIZES}
              className={cn(
                "translate-x-full object-cover text-transparent transition-transform duration-700 group-hover:translate-x-0 motion-reduce:transition-none",
                SLIDE_EASE,
              )}
            />
          )}
          {/* Soft top shade keeps the white heart and badge readable on bright photos. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/25 to-transparent" aria-hidden="true" />
          {isGuestFavorite(listing) && (
            <span className="absolute top-2.5 left-2.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-[0_2px_8px_rgba(0,0,0,0.18)] backdrop-blur">
              {t("guestFavorite")}
            </span>
          )}
          {listing.ratingCount > 0 && (
            <span
              className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-semibold text-ink tabular-nums shadow-[0_2px_8px_rgba(0,0,0,0.18)] backdrop-blur"
              aria-label={t("rating", { rating: listing.ratingAvg })}
            >
              <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span aria-hidden="true">{listing.ratingAvg.toFixed(2)}</span>
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 px-1.5 pt-3 pb-1 tabular-nums">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] leading-5 font-semibold tracking-[-0.01em] text-ink">
              {t("typeIn", { type: tType(listing.type), city: listing.city })}
            </h3>
            <p className="truncate text-[13px] leading-5 text-muted">{listing.title}</p>
          </div>

          <div className="flex gap-1.5 overflow-hidden text-[11px] font-medium text-ink/70">
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-canvas px-2 py-0.5">
              <MapPin className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{listing.district}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-canvas px-2 py-0.5">
              <Users className="size-3 shrink-0" aria-hidden="true" />
              {t("guests", { count: listing.maxGuests })}
            </span>
          </div>

          <div className="mt-auto border-t border-line/70 pt-2.5">
            {price && <p className="truncate text-[13px] text-muted">{price}</p>}
          </div>
        </div>
      </Link>
      <FavoriteButton
        listingId={listing.id}
        title={listing.title}
        initialSaved={saved}
        signedIn={signedIn}
        className="absolute top-3.5 right-3.5"
      />
    </div>
  );
}
