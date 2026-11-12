import { ArrowLeft, ChevronLeft, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { bookableWindow } from "@/features/bookings/availability";
import { feesFor } from "@/features/bookings/money";
import { bookedForRoom } from "@/features/bookings/service";
import { BookingCard, MobileBookingBar, MobileBookingPlan, StayCalendar, StayProvider } from "@/features/listings/components/detail/Booking";
import { DetailSection } from "@/features/listings/components/detail/DetailSection";
import { FACILITY_ICONS } from "@/features/listings/components/detail/facility-icons";
import { ListingPhotos } from "@/features/listings/components/detail/ListingPhotos";
import { listingPath } from "@/features/listings/links";
import { ONLY_ROOM, roomLabel } from "@/features/rooms/links";
import { getSettings, holdMinutesFrom, policyText } from "@/features/settings/service";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
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

  const [t, tRooms, tFacility, tType, locale, settings, booked, user] = await Promise.all([
    getTranslations("Listings"),
    getTranslations("Rooms"),
    getTranslations("Facility"),
    getTranslations("ListingType"),
    getLocale(),
    getSettings(),
    bookedForRoom(listingId, roomId, number),
    getCurrentUser(),
  ]);
  const label = number ? roomLabel(number, (n) => tRooms("roomNumber", { number: n })) : null;
  const title = label ? `${room.name} · ${label}` : room.name;
  // Lodge rooms have one bed: no guests to choose.
  const guestLimit = listing.type === "LODGE" ? 1 : room.maxGuests;
  const typePath = `${listingPath(listing.id, listing.title)}/rooms/${room.id}`;
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
    maxGuests: guestLimit,
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
      <PageContainer className="pt-0 pb-40 md:pt-8 md:pb-16">
        {/* Computers: back to the room type, and the room's name. */}
        <div className="mb-6 hidden md:block">
          <Link href={typePath} className="mb-2 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
            <ChevronLeft className="size-4" aria-hidden="true" />
            {tRooms("allRoomsOf", { name: room.name })}
          </Link>
          <h1 className="font-display text-[28px] leading-9 font-bold tracking-[-0.025em] text-ink">{title}</h1>
        </div>

        <div className="relative">
          <ListingPhotos title={title} photos={photos} />
          {/* Phones: round back button over the photo. */}
          <Link
            href={typePath}
            aria-label={tRooms("allRoomsOf", { name: room.name })}
            className="absolute top-4 left-0 z-10 flex size-10 items-center justify-center rounded-full bg-white/95 text-ink shadow-[0_4px_14px_rgba(0,0,0,0.25)] backdrop-blur transition-transform duration-200 active:scale-90 md:hidden"
          >
            <ArrowLeft className="size-[18px]" aria-hidden="true" />
          </Link>
        </div>

        {/* Phones: the details sit on a rounded sheet that overlaps the photo. */}
        <div
          className={
            "relative z-[1] -mx-4 -mt-6 grid gap-x-16 rounded-t-[28px] bg-canvas px-4 pt-8 " +
            "md:mx-0 md:mt-10 md:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] md:rounded-none md:bg-transparent md:px-0 md:pt-0"
          }
        >
          <div className="min-w-0">
            <div className="pb-8 text-center md:text-left">
              <h1 className="mb-3 font-display text-[22px] leading-7 font-bold tracking-[-0.025em] md:hidden">{title}</h1>
              <h2 className="text-[15px] font-semibold text-ink/80 md:font-display md:text-[22px] md:leading-7 md:font-bold md:tracking-[-0.02em] md:text-ink">{listing.title}</h2>
              <p className="mt-1 text-[15px] text-ink/80">
                {listing.district}, {listing.city}
              </p>
            </div>

            {room.description && (
              <DetailSection>
                <p className="text-[15px] leading-7 whitespace-pre-line text-ink/85">{room.description}</p>
              </DetailSection>
            )}
            {room.facilities.length > 0 && (
              <DetailSection title={t("offers")}>
                <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {room.facilities.map((f) => {
                    const Icon = FACILITY_ICONS[f] ?? ShieldCheck;
                    return (
                      <li key={f} className="flex items-center gap-4 text-[15px] text-ink">
                        <Icon className="size-6 shrink-0" strokeWidth={1.6} aria-hidden="true" />
                        {tFacility(f)}
                      </li>
                    );
                  })}
                </ul>
              </DetailSection>
            )}
            {/* Phones: how and when to book; then this room's calendar (booked days are marked). */}
            <MobileBookingPlan rates={rates} maxGuests={guestLimit} />
            <StayCalendar city={listing.city} rates={rates} always />
          </div>
          <div className="hidden md:block">
            <div className="sticky top-[97px]">
              <BookingCard rates={rates} discountPercent={listing.discountPercent} maxGuests={guestLimit} place={preview} signedIn={user !== null} />
            </div>
          </div>
        </div>
      </PageContainer>
      {rates.length > 0 && <MobileBookingBar rates={rates} discountPercent={listing.discountPercent} place={preview} signedIn={user !== null} />}
    </StayProvider>
  );
}
