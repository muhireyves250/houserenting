import { notFound } from "next/navigation";
import { unitDetailsMap } from "@/features/rooms/validation";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { PageIntro } from "@/features/admin/components/ui";
import { ListingForm } from "@/features/hosting/components/ListingForm";
import { ListingPhotosEditor } from "@/features/hosting/components/ListingPhotosEditor";
import { SectionNav } from "@/features/hosting/components/SectionNav";
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
  if (!listing) notFound();
  // Archived places aren't edited: their page offers Restore.
  if (listing.status === "ARCHIVED") redirect({ href: `/admin/listings/${id}`, locale: await getLocale() });
  const [tPlaces, tHost, tRooms, rooms] = await Promise.all([getTranslations("Places"), getTranslations("Host"), getTranslations("Rooms"), listingRooms(id)]);
  const hasRooms = listing.bookingModel !== "WHOLE_PROPERTY" || rooms.length > 0;
  const sections = [
    // A lodge's size and prices are on its rooms: no "space" part, and "prices" are its booking rules.
    ...(["photos", "basics", "location", "space", "amenities", "prices", "availability", "extras"] as const)
      .filter((id) => !(listing.type === "LODGE" && id === "space"))
      .map((id) => ({ id, label: listing.type === "LODGE" && id === "prices" ? tHost("lodge.rulesTitle") : tHost(`sections.${id}`) })),
    ...(hasRooms ? [{ id: "rooms", label: tRooms("title") }] : []),
  ];
  return (
    <div className="flex flex-col gap-4">
      <PageIntro back={{ href: `/admin/listings/${id}`, label: listing.title }} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_200px] lg:gap-8">
        {/* Section links: beside the form on computers, a row on top on phones. */}
        <div className="sticky top-16 z-10 -mx-3 bg-canvas/95 px-3 py-2 backdrop-blur md:-mx-5 md:px-5 lg:top-24 lg:order-2 lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          <SectionNav items={sections} label={tPlaces("jumpTo")} />
        </div>
        <div className="flex max-w-3xl min-w-0 flex-col gap-4 lg:order-1">
          <p className="rounded-2xl bg-primary-soft px-5 py-3 text-[14px] text-ink">{tPlaces("staffEditNote")}</p>
          <ListingPhotosEditor listingId={id} photos={listing.photos.map((p) => ({ id: p.id, url: p.url }))} enabled={uploadsEnabled()} />
          <ListingForm listingId={id} initial={toListingInput(listing)} live={false} staff={{ ownerId: listing.hostId }} />
          {hasRooms && (
            <RoomsEditor
              listingId={id}
              rooms={rooms.map(({ id: roomId, name, description, maxGuests, rates, facilities, status, numbers, photos, unitDetails }) => ({ id: roomId, name, description, maxGuests, rates, facilities, status, numbers, photos, unitDetails: unitDetailsMap(unitDetails) }))}
              units={rateUnitsFor(listing.type)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
