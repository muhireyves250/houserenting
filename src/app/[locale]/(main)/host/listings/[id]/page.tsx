import { ChevronLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { HostStatus } from "@/features/hosting/components/HostStatus";
import { ListingActions } from "@/features/hosting/components/ListingActions";
import { ListingForm } from "@/features/hosting/components/ListingForm";
import { ListingPhotosEditor } from "@/features/hosting/components/ListingPhotosEditor";
import { getHostListing } from "@/features/hosting/service";
import { toListingInput } from "@/features/hosting/to-input";
import { rateUnitsFor } from "@/features/hosting/validation";
import { Link } from "@/i18n/navigation";
import { uploadsEnabled } from "@/lib/cloudinary";
import { requireUser } from "@/lib/session";
import { OWNER_EDITABLE } from "@/features/listings/lifecycle";
import { BlocksPanel } from "@/features/places/components/BlocksPanel";
import { DocumentsPanel } from "@/features/places/components/DocumentsPanel";
import { Card } from "@/features/hosting/components/fields";
import { listingBlocks } from "@/features/places/blocks-service";
import { listingDocuments } from "@/features/places/documents-service";
import { payoutAccountOf } from "@/features/places/payout-service";
import { can, placeRole } from "@/features/places/access";
import { db } from "@/lib/db";
import { RoomsEditor } from "@/features/rooms/components/RoomsEditor";
import { listingRooms } from "@/features/rooms/service";

type Props = { params: Promise<{ id: string }> };

export default async function EditListingPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/host/listings/${id}`);
  // The owner and managers edit here; bookings and the front desk are VIIPA's.
  const role = await placeRole(user, id);
  if (!can(role, "edit")) notFound();
  const owner = can(role, "money");
  const hostId = (await db.listing.findUnique({ where: { id }, select: { hostId: true } }))!.hostId;
  const listing = await getHostListing(hostId, id);
  if (!listing || listing.status === "ARCHIVED") notFound();
  const [t, tPlaces, rooms, blocks, documents, payout] = await Promise.all([
    getTranslations("Host"),
    getTranslations("Places"),
    listingRooms(listing.id),
    listingBlocks(listing.id),
    owner ? listingDocuments(listing.id) : [],
    payoutAccountOf(hostId),
  ]);
  // Owners add their place and change it until it's sent for review; after that VIIPA manages it.
  const editable = OWNER_EDITABLE.includes(listing.status);

  const initial = toListingInput(listing);

  const canSubmit = listing.status === "DRAFT" || listing.status === "REJECTED" || listing.status === "CHANGES_REQUESTED";
  const reasonShown = ["REJECTED", "CHANGES_REQUESTED", "HIDDEN", "SUSPENDED"].includes(listing.status) && listing.rejectionReason;
  const payoutNeeded = owner && listing.operator === "OWNER" && !payout?.verifiedAt;

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
      {reasonShown && (
        <p className="mb-4 rounded-2xl bg-red-50 px-5 py-3.5 text-sm text-red-900 ring-1 ring-red-200/70">
          {t("needsChanges", { reason: listing.rejectionReason ?? "" })}
        </p>
      )}
      {payoutNeeded && (
        <p className="mb-4 rounded-2xl bg-amber-50 px-5 py-3.5 text-sm text-amber-900 ring-1 ring-amber-200/70">
          {payout ? tPlaces("payoutAwaiting") : tPlaces("payoutNeeded")}{" "}
          <Link href="/host/payout" className="font-semibold underline">
            {tPlaces("payoutLink")}
          </Link>
        </p>
      )}
      {listing.status === "PENDING_REVIEW" && (
        <p className="mb-4 rounded-2xl bg-amber-50 px-5 py-3.5 text-sm text-amber-900 ring-1 ring-amber-200/70">{t("inReviewNote")}</p>
      )}
      {!editable && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl bg-primary-soft px-5 py-4 text-[14px] text-ink">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            {tPlaces("managedByViipa")}{" "}
            <Link href={{ pathname: "/support", query: { listing: listing.id } }} className="font-semibold text-primary underline">
              {tPlaces("askForChange")}
            </Link>
          </span>
        </div>
      )}
      <div className="flex flex-col gap-4">
        {editable && (
          <>
            <ListingPhotosEditor listingId={listing.id} photos={listing.photos.map((p) => ({ id: p.id, url: p.url }))} enabled={uploadsEnabled()} />
            <ListingForm listingId={listing.id} initial={initial} live={false} />
            {(listing.bookingModel !== "WHOLE_PROPERTY" || rooms.length > 0) && (
              <RoomsEditor
                listingId={listing.id}
                rooms={rooms.map(({ id, name, description, maxGuests, rates, facilities, status, numbers }) => ({ id, name, description, maxGuests, rates, facilities, status, numbers }))}
                units={rateUnitsFor(listing.type)}
              />
            )}
          </>
        )}
        <Card title={tPlaces("blocksTitle")}>
          <BlocksPanel listingId={listing.id} rooms={rooms.map((r) => ({ id: r.id, name: r.name }))} active={blocks.active} past={blocks.past} />
        </Card>
        {owner && (
          <>
            <Card title={tPlaces("documentsTitle")}>
              <DocumentsPanel listingId={listing.id} documents={documents} />
            </Card>
            {editable && <ListingActions listingId={listing.id} canSubmit={canSubmit} />}
          </>
        )}
      </div>
    </PageContainer>
  );
}
