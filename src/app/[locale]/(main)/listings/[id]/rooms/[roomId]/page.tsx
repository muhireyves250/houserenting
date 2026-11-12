import { ArrowLeft, BedDouble, ChevronLeft, ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { bookedRanges, bookedRoomNumbers } from "@/features/bookings/service";
import { listingIdCandidates, listingPath } from "@/features/listings/links";
import { discountedPrice } from "@/features/listings/pricing";
import { getPublishedListingByParam } from "@/features/listings/service";
import { ONLY_ROOM, roomLabel } from "@/features/rooms/links";
import { DetailSection } from "@/features/listings/components/detail/DetailSection";
import { ListingPhotos } from "@/features/listings/components/detail/ListingPhotos";
import { todayISO } from "@/features/search/date-range";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";

type Props = { params: Promise<{ id: string; roomId: string }> };

/**
 * A lodge's room type: every room of that type with whether it's free today (and when booked rooms are free
 * again), each with its photo and price; tapping one opens that room's page to book it. A type without
 * room numbers is one room.
 */
export default async function RoomTypePage({ params }: Props) {
  const { id, roomId } = await params;
  const listing = await getPublishedListingByParam(listingIdCandidates(id));
  if (!listing) notFound();
  const room = await db.room.findFirst({ where: { id: roomId, listingId: listing.id, status: "AVAILABLE" }, include: { rates: true } });
  if (!room) notFound();

  const [t, tListings, locale, booked, numbers] = await Promise.all([getTranslations("Rooms"), getTranslations("Listings"), getLocale(), bookedRanges(listing.id), bookedRoomNumbers(listing.id)]);
  const today = todayISO();
  const base = listingPath(listing.id, listing.title);
  const shortDate = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  // Whole-place bookings and blocks on this type take every room.
  const allTaken = booked.find((b) => (b.roomId === null || b.roomId === room.id) && b.checkIn <= today && today < b.checkOut);
  const status = (n: string) => {
    // A type without numbers is one room: its bookings are the type's own.
    const own = n === ONLY_ROOM ? booked.filter((b) => b.roomId === null || b.roomId === room.id) : numbers.filter((b) => b.roomId === room.id && b.roomNumber === n);
    const now = allTaken ?? own.find((b) => b.checkIn <= today && today < b.checkOut);
    if (!now) return { free: true as const };
    // Follow back-to-back bookings to the first free day.
    let free = now.checkOut;
    for (let guard = 0; guard < 100; guard++) {
      const next = own.find((b) => b.checkIn <= free && free < b.checkOut);
      if (!next) break;
      free = next.checkOut;
    }
    return { free: false as const, freeFrom: free };
  };
  const rows = (room.numbers.length > 0 ? room.numbers : [ONLY_ROOM]).map((n) => ({ n, s: status(n) }));
  const free = rows.filter((r) => r.s.free).length;
  const photos = (room.photos.length > 0 ? room.photos.map((url, i) => ({ id: `room-${i}`, url })) : listing.photos.map((p) => ({ id: p.id, url: p.url }))).slice(0, 12);
  const photo = photos[0]?.url ?? null;
  const label = (n: string) => (n === ONLY_ROOM ? room.name : roomLabel(n, (number) => t("roomNumber", { number })));
  const cheapest = [...room.rates].sort((a, b) => a.price - b.price)[0];

  return (
    <PageContainer className="pt-0 pb-16 md:pt-8">
      {/* Computers: back to the lodge, and the type's name. */}
      <div className="mb-6 hidden md:block">
        <Link href={`${base}#room-types`} className="mb-2 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden="true" />
          {listing.title}
        </Link>
        <h1 className="font-display text-[28px] leading-9 font-bold tracking-[-0.025em] text-ink">{room.name}</h1>
      </div>

      <div className="relative">
        <ListingPhotos title={room.name} photos={photos} />
        {/* Phones: round back button over the photo. */}
        <Link
          href={`${base}#room-types`}
          aria-label={listing.title}
          className="absolute top-4 left-0 z-10 flex size-10 items-center justify-center rounded-full bg-white/95 text-ink shadow-[0_4px_14px_rgba(0,0,0,0.25)] backdrop-blur transition-transform duration-200 active:scale-90 md:hidden"
        >
          <ArrowLeft className="size-[18px]" aria-hidden="true" />
        </Link>
      </div>

      {/* Phones: the details sit on a rounded sheet that overlaps the photo. */}
      <div className="relative z-[1] -mx-4 -mt-6 rounded-t-[28px] bg-canvas px-4 pt-8 md:mx-0 md:mt-10 md:rounded-none md:bg-transparent md:px-0 md:pt-0">
        <div className="pb-8 text-center md:text-left">
          <h1 className="mb-3 font-display text-[22px] leading-7 font-bold tracking-[-0.025em] md:hidden">{room.name}</h1>
          <h2 className="text-[15px] font-semibold text-ink/80 md:font-display md:text-[22px] md:leading-7 md:font-bold md:tracking-[-0.02em] md:text-ink">{listing.title}</h2>
          <p className="mt-1 text-[15px] text-ink/80">
            {t("roomsCount", { count: rows.length })}
            {cheapest && (
              <>
                {" · "}
                {t("fromPrice")} <b className="font-semibold text-ink">{formatRWF(discountedPrice(cheapest.price, listing.discountPercent), locale)}</b> {tListings(`perUnit.${cheapest.unit}`)}
              </>
            )}
          </p>
          <p className={cn("mt-3 inline-block rounded-full px-3 py-1 text-[13px] font-bold", free > 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>
            {t("freeTodayCount", { free, total: rows.length })}
          </p>
        </div>

        {room.description && (
          <DetailSection>
            <p className="text-[15px] leading-7 whitespace-pre-line text-ink/85">{room.description}</p>
          </DetailSection>
        )}

        <DetailSection title={t("chooseRoomTitle")}>
          <p className="-mt-3 mb-5 text-[14px] text-muted">{t("chooseRoomIntro")}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
        {rows.map(({ n, s }) => (
          <li key={n}>
            <Link
              href={`${base}/rooms/${room.id}/${encodeURIComponent(n)}`}
              className={cn(
                "flex h-full flex-col overflow-hidden rounded-2xl bg-surface ring-1 transition-shadow hover:shadow-[0_8px_24px_-14px_rgba(16,24,40,0.4)]",
                s.free ? "ring-emerald-200" : "ring-red-200",
              )}
            >
              <span className="relative block aspect-[4/3] bg-primary-soft">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- room photo
                  <img src={photo} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <BedDouble className="absolute inset-0 m-auto size-8 text-primary" aria-hidden="true" />
                )}
                <span className={cn("absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-[12px] font-bold shadow-sm", s.free ? "bg-white text-emerald-800" : "bg-red-600 text-white")}>
                  {s.free ? t("availableOn", { day: t("today") }) : t("bookedOn", { day: t("today") })}
                </span>
              </span>
              <span className="flex flex-1 flex-col gap-1 p-3">
                <span className="flex items-center justify-between gap-2">
                  <b className="truncate text-[16px] font-bold text-ink tabular-nums">{label(n)}</b>
                  <ChevronRight className="size-4 shrink-0 text-ink/40" aria-hidden="true" />
                </span>
                {cheapest && (
                  <span className="text-[13px] text-ink">
                    <b className="font-semibold">{formatRWF(discountedPrice(cheapest.price, listing.discountPercent), locale)}</b> {tListings(`perUnit.${cheapest.unit}`)}
                  </span>
                )}
                {!s.free && <span className="text-[12px] text-muted">{t("freeFrom", { date: shortDate.format(new Date(`${s.freeFrom}T00:00:00Z`)) })}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
        </DetailSection>
      </div>
    </PageContainer>
  );
}
