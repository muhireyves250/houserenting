import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageIntro } from "@/features/admin/components/ui";
import { ListingForm } from "@/features/hosting/components/ListingForm";
import { ListingPhotosEditor } from "@/features/hosting/components/ListingPhotosEditor";
import { getHostListing } from "@/features/hosting/service";
import { toListingInput } from "@/features/hosting/to-input";
import { rateUnitsFor } from "@/features/hosting/validation";
import { RoomsEditor } from "@/features/rooms/components/RoomsEditor";
import { listingRooms } from "@/features/rooms/service";
import { uploadsEnabled } from "@/lib/cloudinary";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/permissions";

type Props = { params: Promise<{ id: string }> };

/** Staff edit any place directly; changes apply without going back to review. */
export default async function AdminEditListingPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin(`/admin/listings/${id}/edit`);
  const owner = await db.listing.findUnique({ where: { id }, select: { hostId: true } });
  const listing = owner && (await getHostListing(owner.hostId, id));
  if (!listing || listing.status === "ARCHIVED") notFound();
  const [tPlaces, rooms] = await Promise.all([getTranslations("Places"), listingRooms(id)]);
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageIntro back={{ href: `/admin/listings/${id}`, label: listing.title }} />
      <p className="rounded-2xl bg-primary-soft px-5 py-3 text-[14px] text-ink">{tPlaces("staffEditNote")}</p>
      <ListingPhotosEditor listingId={id} photos={listing.photos.map((p) => ({ id: p.id, url: p.url }))} enabled={uploadsEnabled()} />
      <ListingForm listingId={id} initial={toListingInput(listing)} live={false} staff={{ ownerId: listing.hostId }} />
      {(listing.bookingModel !== "WHOLE_PROPERTY" || rooms.length > 0) && (
        <RoomsEditor
          listingId={id}
          rooms={rooms.map(({ id: roomId, name, description, maxGuests, rates, facilities, status }) => ({ id: roomId, name, description, maxGuests, rates, facilities, status }))}
          units={rateUnitsFor(listing.type)}
        />
      )}
    </div>
  );
}
