import { BedDouble, ChevronLeft, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { bookableWindow } from "@/features/bookings/availability";
import { feesFor } from "@/features/bookings/money";
import { bookedForRoom } from "@/features/bookings/service";
import { BookingCard, MobileBookingBar, MobileBookingPlan, StayCalendar, StayProvider } from "@/features/listings/components/detail/Booking";
import { ListingPhotos } from "@/features/listings/components/detail/ListingPhotos";
import { listingPath } from "@/features/listings/links";
import { ONLY_ROOM } from "@/features/rooms/links";
import { discountedPrice } from "@/features/listings/pricing";
import { getSettings, holdMinutesFrom, policyText } from "@/features/settings/service";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

const UNIT_ORDER = ["HOUR", "DAY", "NIGHT", "WEEK", "MONTH", "YEAR"];
const isoDay = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

/**
 * One room of a lodge: its photos, details and prices, its own calendar (days it's booked are marked) and the
 * booking card, which books exactly this room (this number of the room type).
 */
export async function RoomBookingView({ listingId, roomId, number: asked }: { listingId: string; roomId: string; number: string }) {
  const [listing, room] = await Promise.all([
    db.listing.findFirst({
      where: { id: listingId, status: "PUBLISHED" },
      include: { photos: { orderBy: { position: "asc" } }, rates: true },
    }),
    db.room.findFirst({ where: { id: roomId, listingId, status: "AVAILABLE" }, include: { rates: true } }),
  ]);
  if (!listing || !room) notFound();
  // A type with no room numbers is a single room, opened as ONLY_ROOM.
  const number = room.numbers.length === 0 && asked === ONLY_ROOM ? null : asked;
  if (number !== null && !room.numbers.includes(number)) notFound();

  const [t, tRooms, tListings, tFacility, tType, locale, settings, booked, user] = await Promise.all([
    getTranslations("Listings"),
    getTranslations("Rooms"),
    getTranslations("Listings"),
    getTranslations("Facility"),
    getTranslations("ListingType"),
    getLocale(),
    getSettings(),
    bookedForRoom(listingId, roomId, number),
    getCurrentUser(),
  ]);
  const title = number ? `${room.name} · ${tRooms("roomNumber", { number })}` : room.name;
  const photos = (room.photos.length > 0 ? room.photos.map((url, i) => ({ id: `room-${i}`, url })) : listing.photos.map((p) => ({ id: p.id, url: p.url }))).slice(0, 12);
  // The place's rules for each way of booking (hours, check-in…), with this room's own prices.
  const rates = listing.rates
    .filter((r) => room.rates.some((rr) => rr.unit === r.unit))
    .sort((a, b) => UNIT_ORDER.indexOf(a.unit) - UNIT_ORDER.indexOf(b.unit))
    .map(({ unit, minUnits, maxUnits, checkInTime, checkOutTime, dayStartTime, dayEndTime }) => ({
      unit,
      price: room.rates.find((r) => r.unit === unit)!.price,
      minUnits,
      maxUnits,
      checkInTime,
      checkOutTime,
      dayStartTime,
      dayEndTime,
    }));
  const publicRoom = {
    id: room.id,
    name: room.name,
    description: room.description,
    maxGuests: room.maxGuests,
    facilities: room.facilities,
    rates: room.rates.map((r) => ({ unit: r.unit, price: r.price })),
    numbers: room.numbers,
  };
  const preview = { title: `${listing.title} · ${title}`, subtitle: `${tType(listing.type)} · ${listing.district}, ${listing.city}`, photo: photos[0]?.url ?? null };

  return (
    <StayProvider
      listingId={listing.id}
      booked={booked}
      holdMinutes={holdMinutesFrom(settings)}
      rooms={[publicRoom]}
      initialRoom={room.id}
      initialRoomNumber={number}
      bookingModel="ROOM_BY_ROOM"
      guestFeeBps={feesFor(settings, listing.type).guestFeeBps}
      cancellationPolicy={policyText(settings.cancellationPolicy, locale)}
      longStay={null}
      defaultUnit={rates.some((r) => r.unit === "NIGHT") ? "NIGHT" : (rates[0]?.unit ?? "NIGHT")}
      window={bookableWindow({
        contractStart: isoDay(listing.contractStart),
        contractEnd: isoDay(listing.contractEnd),
        availableFrom: isoDay(listing.availableFrom),
        availableUntil: isoDay(listing.availableUntil),
      })}
      workingDays={listing.workingDays}
    >
      <PageContainer className="pt-4 pb-40 md:pt-8 md:pb-16">
        <Link href={`${listingPath(listing.id, listing.title)}/rooms/${room.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden="true" />
          {tRooms("allRoomsOf", { name: room.name })}
        </Link>
        <h1 className="mb-1 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{title}</h1>
        <p className="mb-5 text-[14px] text-muted">
          {listing.title} · {listing.district}, {listing.city}
        </p>
        <ListingPhotos title={title} photos={photos} />

        <div className="mt-8 grid gap-12 md:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            <section className="flex flex-wrap gap-x-6 gap-y-2 border-b border-line pb-6 text-[15px] text-ink">
              <span className="inline-flex items-center gap-2">
                <Users className="size-5 text-primary" aria-hidden="true" />
                {tRooms("guests", { count: room.maxGuests })}
              </span>
              {number && (
                <span className="inline-flex items-center gap-2">
                  <BedDouble className="size-5 text-primary" aria-hidden="true" />
                  {tRooms("roomNumber", { number })}
                </span>
              )}
            </section>
            {room.description && <p className="border-b border-line py-6 text-[15px] leading-7 whitespace-pre-line text-ink/85">{room.description}</p>}
            {room.facilities.length > 0 && (
              <section className="border-b border-line py-6">
                <h2 className="mb-3 text-[20px] font-bold text-ink">{t("offers")}</h2>
                <ul className="grid gap-2 text-[15px] text-ink sm:grid-cols-2">
                  {room.facilities.map((f) => (
                    <li key={f}>{tFacility(f)}</li>
                  ))}
                </ul>
              </section>
            )}
            <section className="border-b border-line py-6">
              <h2 className="mb-3 text-[20px] font-bold text-ink">{t("prices")}</h2>
              <ul className="flex flex-col gap-1.5 text-[15px] text-ink/85 tabular-nums">
                {rates.map((r) => (
                  <li key={r.unit}>
                    {tListings(`unitName.${r.unit}`)} · <b className="font-semibold text-ink">{formatRWF(discountedPrice(r.price, listing.discountPercent), locale)}</b> {tListings(`perUnit.${r.unit}`)}
                  </li>
                ))}
              </ul>
            </section>
            {/* Phones: how and when to book; then this room's calendar (booked days are marked). */}
            <MobileBookingPlan rates={rates} maxGuests={room.maxGuests} />
            <StayCalendar city={listing.city} rates={rates} always />
          </div>
          <div className="hidden md:block">
            <div className="sticky top-[97px]">
              <BookingCard rates={rates} discountPercent={listing.discountPercent} maxGuests={room.maxGuests} place={preview} signedIn={user !== null} />
            </div>
          </div>
        </div>
      </PageContainer>
      {rates.length > 0 && <MobileBookingBar rates={rates} discountPercent={listing.discountPercent} place={preview} signedIn={user !== null} />}
    </StayProvider>
  );
}
