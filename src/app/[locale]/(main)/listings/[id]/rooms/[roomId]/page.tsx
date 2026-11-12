import { BedDouble, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { bookedRanges, bookedRoomNumbers } from "@/features/bookings/service";
import { listingIdCandidates, listingPath } from "@/features/listings/links";
import { discountedPrice } from "@/features/listings/pricing";
import { getPublishedListingByParam } from "@/features/listings/service";
import { RoomBookingView } from "@/features/rooms/components/RoomBookingView";
import { todayISO } from "@/features/search/date-range";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";

type Props = { params: Promise<{ id: string; roomId: string }> };

/**
 * A lodge's room type: every room of that type with whether it's free today (and when booked rooms are free
 * again); tapping one opens that room's page to book it. A type that is a single room opens straight to it.
 */
export default async function RoomTypePage({ params }: Props) {
  const { id, roomId } = await params;
  const listing = await getPublishedListingByParam(listingIdCandidates(id));
  if (!listing) notFound();
  const room = await db.room.findFirst({ where: { id: roomId, listingId: listing.id, status: "AVAILABLE" }, include: { rates: true } });
  if (!room) notFound();
  if (room.numbers.length <= 1) return <RoomBookingView listingId={listing.id} roomId={room.id} number={room.numbers[0] ?? null} />;

  const [t, tListings, locale, booked, numbers] = await Promise.all([getTranslations("Rooms"), getTranslations("Listings"), getLocale(), bookedRanges(listing.id), bookedRoomNumbers(listing.id)]);
  const today = todayISO();
  const base = listingPath(listing.id, listing.title);
  const shortDate = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  // Whole-place bookings and blocks on this type take every room.
  const allTaken = booked.find((b) => (b.roomId === null || b.roomId === room.id) && b.checkIn <= today && today < b.checkOut);
  const status = (n: string) => {
    const own = numbers.filter((b) => b.roomId === room.id && b.roomNumber === n);
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
  const rows = room.numbers.map((n) => ({ n, s: status(n) }));
  const free = rows.filter((r) => r.s.free).length;
  const photo = room.photos[0] ?? listing.photos[0]?.url ?? null;
  const cheapest = [...room.rates].sort((a, b) => a.price - b.price)[0];

  return (
    <PageContainer className="max-w-4xl pt-4 pb-16 md:pt-8">
      <Link href={`${base}#room-types`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {listing.title}
      </Link>
      <section className="overflow-hidden rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-line md:flex">
        <span className="relative block aspect-[16/10] bg-primary-soft md:aspect-auto md:w-1/2">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- room type photo
            <img src={photo} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <BedDouble className="absolute inset-0 m-auto size-10 text-primary" aria-hidden="true" />
          )}
        </span>
        <div className="flex flex-col gap-2 p-5 md:w-1/2 md:p-7">
          <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink">{room.name}</h1>
          <p className="flex flex-wrap gap-x-4 text-[14px] text-muted">
            <span className="inline-flex items-center gap-1">
              <Users className="size-4" aria-hidden="true" />
              {t("guests", { count: room.maxGuests })}
            </span>
            <span>{t("roomsCount", { count: room.numbers.length })}</span>
          </p>
          {cheapest && (
            <p className="text-[15px] text-ink">
              {t("fromPrice")} <b className="font-bold">{formatRWF(discountedPrice(cheapest.price, listing.discountPercent), locale)}</b> {tListings(`perUnit.${cheapest.unit}`)}
            </p>
          )}
          {room.description && <p className="text-[14px] leading-6 text-ink/80">{room.description}</p>}
          <p className={cn("mt-1 self-start rounded-full px-3 py-1 text-[13px] font-bold", free > 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700")}>
            {t("freeTodayCount", { free, total: room.numbers.length })}
          </p>
        </div>
      </section>

      <h2 className="mt-8 mb-1 text-[20px] font-bold text-ink">{t("chooseRoomTitle")}</h2>
      <p className="mb-4 text-[14px] text-muted">{t("chooseRoomIntro")}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {rows.map(({ n, s }) => (
          <li key={n}>
            <Link
              href={`${base}/rooms/${room.id}/${encodeURIComponent(n)}`}
              className={cn(
                "flex h-full flex-col gap-1 rounded-2xl bg-surface p-4 ring-1 transition-shadow hover:shadow-[0_8px_24px_-14px_rgba(16,24,40,0.4)]",
                s.free ? "ring-emerald-200" : "ring-red-200",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <b className="text-[18px] font-bold text-ink tabular-nums">{t("roomNumber", { number: n })}</b>
                <ChevronRight className="size-4 text-ink/40" aria-hidden="true" />
              </span>
              <span className={cn("text-[13px] font-semibold", s.free ? "text-emerald-700" : "text-red-700")}>
                {s.free ? t("availableOn", { day: t("today") }) : t("bookedOn", { day: t("today") })}
              </span>
              {!s.free && <span className="text-[12px] text-muted">{t("freeFrom", { date: shortDate.format(new Date(`${s.freeFrom}T00:00:00Z`)) })}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
