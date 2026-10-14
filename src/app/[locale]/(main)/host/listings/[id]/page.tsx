import { ChevronLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { HostStatus } from "@/features/hosting/components/HostStatus";
import { ListingActions } from "@/features/hosting/components/ListingActions";
import { ListingForm } from "@/features/hosting/components/ListingForm";
import { ListingPhotosEditor } from "@/features/hosting/components/ListingPhotosEditor";
import { getHostListing } from "@/features/hosting/service";
import type { ListingInput } from "@/features/hosting/validation";
import { Link } from "@/i18n/navigation";
import { uploadsEnabled } from "@/lib/cloudinary";
import { requireUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export default async function EditListingPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/host/listings/${id}`);
  const listing = await getHostListing(user.id, id);
  if (!listing || listing.status === "ARCHIVED") notFound();
  const t = await getTranslations("Host");

  const initial: ListingInput = {
    title: listing.title,
    description: listing.description,
    type: listing.type,
    addressLine: listing.addressLine,
    district: listing.district,
    city: listing.city,
    lat: listing.lat,
    lng: listing.lng,
    sizeM2: listing.sizeM2,
    rooms: listing.rooms,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    maxGuests: listing.maxGuests,
    petsAllowed: listing.petsAllowed,
    facilities: listing.facilities,
    characteristics: listing.characteristics,
    termsOfRent: listing.termsOfRent,
    depositMonths: listing.depositMonths,
    discountPercent: listing.discountPercent,
    rates: listing.rates.map(({ unit, price, minUnits, maxUnits, checkInTime, checkOutTime, dayStartTime, dayEndTime }) => ({
      unit,
      price,
      minUnits,
      maxUnits,
      checkInTime,
      checkOutTime,
      dayStartTime,
      dayEndTime,
    })),
  };
  const canSubmit = listing.status === "DRAFT" || listing.status === "REJECTED";

  return (
    <PageContainer className="max-w-3xl py-6 md:py-10">
      <Link href="/host" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("title")}
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{listing.title}</h1>
        <HostStatus status={listing.status} label={t(`status.${listing.status}`)} />
        {listing.status === "PUBLISHED" && (
          <Link href={`/listings/${listing.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            {t("viewLive")}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      {listing.status === "REJECTED" && listing.rejectionReason && (
        <p className="mb-4 rounded-2xl bg-red-50 px-5 py-3.5 text-sm text-red-900 ring-1 ring-red-200/70">
          {t("needsChanges", { reason: listing.rejectionReason })}
        </p>
      )}
      {listing.status === "PENDING_REVIEW" && (
        <p className="mb-4 rounded-2xl bg-amber-50 px-5 py-3.5 text-sm text-amber-900 ring-1 ring-amber-200/70">{t("inReviewNote")}</p>
      )}
      <div className="flex flex-col gap-4">
        <ListingPhotosEditor listingId={listing.id} photos={listing.photos.map((p) => ({ id: p.id, url: p.url }))} enabled={uploadsEnabled()} />
        <ListingForm listingId={listing.id} initial={initial} live={listing.status === "PUBLISHED"} />
        <ListingActions listingId={listing.id} canSubmit={canSubmit} />
      </div>
    </PageContainer>
  );
}
