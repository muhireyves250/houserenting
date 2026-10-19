import { ChevronLeft, ExternalLink } from "lucide-react";
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
import { movesFrom } from "@/features/listings/lifecycle";
import { BlocksPanel } from "@/features/places/components/BlocksPanel";
import { DocumentsPanel } from "@/features/places/components/DocumentsPanel";
import { StatusActions } from "@/features/places/components/StatusActions";
import { Card } from "@/features/hosting/components/fields";
import { listingBlocks } from "@/features/places/blocks-service";
import { listingDocuments } from "@/features/places/documents-service";
import { payoutAccountOf } from "@/features/places/payout-service";
import { can, placeRole } from "@/features/places/access";
import { TeamPanel } from "@/features/places/components/TeamPanel";
import { listTeam } from "@/features/places/team-service";
import { redirect } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getLocale } from "next-intl/server";
import { RoomsEditor } from "@/features/rooms/components/RoomsEditor";
import { listingRooms } from "@/features/rooms/service";

type Props = { params: Promise<{ id: string }> };

export default async function EditListingPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/host/listings/${id}`);
  // The owner and managers edit here; receptionists work from the bookings page.
  const role = await placeRole(user, id);
  if (role === "receptionist") redirect({ href: "/host/bookings", locale: await getLocale() });
  if (!can(role, "edit")) notFound();
  const owner = can(role, "money");
  const hostId = (await db.listing.findUnique({ where: { id }, select: { hostId: true } }))!.hostId;
  const listing = await getHostListing(hostId, id);
  if (!listing || listing.status === "ARCHIVED") notFound();
  const [t, tPlaces, rooms, blocks, documents, payout, team] = await Promise.all([
    getTranslations("Host"),
    getTranslations("Places"),
    listingRooms(listing.id),
    listingBlocks(listing.id),
    owner ? listingDocuments(listing.id) : [],
    payoutAccountOf(hostId),
    owner ? listTeam(listing.id) : [],
  ]);
  // Owners pause and resume here; sending for review and removing stay in ListingActions below.
  const ownerMoves = owner ? movesFrom(listing.status, { isStaff: false, isOwner: true }).filter((m) => m === "pause" || m === "resume") : [];

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
      <div className="flex flex-col gap-4">
        <ListingPhotosEditor listingId={listing.id} photos={listing.photos.map((p) => ({ id: p.id, url: p.url }))} enabled={uploadsEnabled()} />
        <ListingForm listingId={listing.id} initial={initial} live={listing.status === "PUBLISHED"} />
        {(listing.bookingModel !== "WHOLE_PROPERTY" || rooms.length > 0) && (
          <RoomsEditor
            listingId={listing.id}
            rooms={rooms.map(({ id, name, description, maxGuests, rates, facilities, status }) => ({ id, name, description, maxGuests, rates, facilities, status }))}
            units={rateUnitsFor(listing.type)}
          />
        )}
        {ownerMoves.length > 0 && (
          <Card title={tPlaces("statusTitle")}>
            <StatusActions listingId={listing.id} moves={ownerMoves} />
          </Card>
        )}
        <Card title={tPlaces("blocksTitle")}>
          <BlocksPanel listingId={listing.id} rooms={rooms.map((r) => ({ id: r.id, name: r.name }))} active={blocks.active} past={blocks.past} />
        </Card>
        {owner && (
          <>
            <Card title={tPlaces("documentsTitle")}>
              <DocumentsPanel listingId={listing.id} documents={documents} />
            </Card>
            <Card title={tPlaces("teamTitle")}>
              <TeamPanel listingId={listing.id} members={team} />
            </Card>
            <ListingActions listingId={listing.id} canSubmit={canSubmit} />
          </>
        )}
      </div>
    </PageContainer>
  );
}
