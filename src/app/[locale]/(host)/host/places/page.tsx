import { House, Pencil, Plus } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { HostStatus } from "@/features/hosting/components/HostStatus";
import { hostDashboard, hostListings } from "@/features/hosting/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireUser } from "@/lib/session";

const newButton =
  "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-[#0a6fe0] px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-[filter,transform] duration-300 hover:brightness-110 active:scale-[0.97]";
const card = "rounded-3xl bg-surface p-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line";

/** The owner's places: each with its photo, status and how booked it is this month; open one to edit it. */
export default async function HostPlacesPage() {
  const user = await requireUser("/host/places");
  const [t, tHost, tType, listings, dash] = await Promise.all([getTranslations("Host.dash"), getTranslations("Host"), getTranslations("ListingType"), hostListings(user.id), hostDashboard(user.id)]);
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-muted">{t("placesCount", { count: listings.length })}</p>
        <Link href="/host/listings/new" className={newButton}>
          <Plus className="size-4" aria-hidden="true" />
          {tHost("newListing")}
        </Link>
      </div>
      {listings.length === 0 ? (
        <EmptyState icon={<House />} title={tHost("emptyTitle")} body={tHost("emptyBody")} />
      ) : (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {listings.map((listing) => {
        const nights = dash.nightsByPlace.get(listing.id) ?? 0;
        const coming = dash.upcomingByPlace.get(listing.id) ?? 0;
        return (
          <li key={listing.id}>
            <Link href={`/host/listings/${listing.id}`} className={cn(card, "group flex h-full overflow-hidden p-0 transition-shadow hover:shadow-[0_16px_40px_-16px_rgba(0,64,160,0.5)] max-sm:rounded-2xl sm:flex-col")}>
              {/* Phones: a compact row (photo on the left); larger screens: a card with the photo on top. */}
              <span className="relative block w-28 shrink-0 bg-primary-soft sm:aspect-[16/10] sm:w-auto">
                {listing.photos[0] ? (
                  <Image src={listing.photos[0].url} alt="" fill sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                ) : (
                  <House className="absolute inset-0 m-auto size-8 text-primary" aria-hidden="true" />
                )}
                <HostStatus status={listing.status} label={tHost(`status.${listing.status}`)} className="absolute top-2 left-2 shadow-sm sm:top-3 sm:left-3" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1 p-3 sm:p-4">
                <span className="line-clamp-1 text-[15px] font-semibold text-ink">{listing.title}</span>
                <span className="truncate text-[13px] text-muted">
                  {tType(listing.type)} · {listing.district}, {listing.city}
                </span>
                {(listing.status === "REJECTED" || listing.status === "CHANGES_REQUESTED") && listing.rejectionReason && (
                  <span className="text-xs font-medium text-red-800">{tHost("needsChanges", { reason: listing.rejectionReason })}</span>
                )}
                <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-[12px] sm:border-t sm:border-line sm:pt-3 sm:text-[12.5px]">
                  <span className="text-ink/80">
                    <b className="font-semibold text-ink">{t("placeNights", { nights })}</b> · {t("placeUpcoming", { count: coming })}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary">
                    <Pencil className="size-3.5" aria-hidden="true" />
                    {t("edit")}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
      )}
    </div>
  );
}
