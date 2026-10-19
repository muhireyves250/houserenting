import { House, KeyRound, LifeBuoy, MapPin, Navigation } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import type { BookingTileData } from "@/features/bookings/components/BookingTile";
import { BookingsTabs } from "@/features/bookings/components/BookingsTabs";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { directionsUrl, formatKigaliTime, formatStayDates } from "@/features/bookings/format";
import { guestBookings, type GuestBooking } from "@/features/bookings/service";
import { stayPhase } from "@/features/bookings/status";
import { todayISO } from "@/features/search/date-range";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { requireUser } from "@/lib/session";

const card = "rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line";
const pillLink =
  "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink transition-[background-color,transform] duration-300 hover:bg-canvas active:scale-95 max-md:border-primary max-md:text-primary";

export default async function BookingsPage() {
  const user = await requireUser("/bookings");
  const [t, tNav, tEmpty, tFooter, tType, tListings, locale] = await Promise.all([
    getTranslations("Bookings"),
    getTranslations("Nav"),
    getTranslations("Empty"),
    getTranslations("Footer"),
    getTranslations("ListingType"),
    getTranslations("Listings"),
    getLocale(),
  ]);
  const now = new Date();
  const today = todayISO(now);
  const bookings = await guestBookings(user.id, now);

  const tile = (b: GuestBooking): BookingTileData => ({
    reference: b.reference,
    status: b.status,
    statusLabel: t(`status.${b.status}`),
    title: b.listing.title,
    place: `${tType(b.listing.type)} · ${b.listing.district}, ${b.listing.city}`,
    photo: b.listing.photos[0]?.url ?? null,
    dates: formatStayDates(locale, b.checkIn, b.checkOut),
    meta:
      b.unit === "NIGHT"
        ? t("nightsGuests", { nights: b.nights, guests: b.guests })
        : tListings(`unitCount.${b.unit}`, { count: b.quantity }),
    note: b.status === "PENDING_PAYMENT" && b.holdExpiresAt ? t("heldUntil", { time: formatKigaliTime(locale, b.holdExpiresAt) }) : null,
    total: formatRWF(b.total, locale),
  });

  const phase = (b: GuestBooking) => stayPhase(b, today, now);
  const current = bookings.find((b) => phase(b) === "current");
  // Soonest first for what's ahead; most recent first for what's behind.
  const upcoming = bookings.filter((b) => phase(b) === "upcoming").reverse().map(tile);
  const past = bookings.filter((b) => phase(b) === "past").map(tile);

  return (
    <PageContainer className="py-6 md:py-10">
      <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] md:text-[32px] md:leading-10">{tNav("bookings")}</h1>

      {/* My stay: always here; the active stay's details, directions and help, or "No active stay". */}
      <section aria-labelledby="my-stay" className="mt-6">
        <h2 id="my-stay" className="mb-3 text-lg font-bold tracking-[-0.01em] text-ink">
          {t("myStay")}
        </h2>
        {current ? (
          <div className={`${card} overflow-hidden`}>
            <Link href="/my-stay" className="relative block h-36 bg-primary-soft md:h-44">
              {current.listing.photos[0] ? (
                <Image src={current.listing.photos[0].url} alt="" fill sizes="(min-width: 768px) 900px, 100vw" className="object-cover" />
              ) : (
                <House className="absolute top-1/2 left-1/2 size-9 -translate-x-1/2 -translate-y-1/2 text-primary/60" aria-hidden="true" />
              )}
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-4 text-white">
                <StatusBadge status={current.status} label={t(`status.${current.status}`)} className="mb-1.5 bg-white text-primary ring-white" />
                <span className="line-clamp-2 block text-[18px] leading-6 font-bold">{current.listing.title}</span>
                <span className="block text-[13px] text-white/90">
                  {formatStayDates(locale, current.checkIn, current.checkOut)} ·{" "}
                  {current.unit === "NIGHT" ? t("nightsGuests", { nights: current.nights, guests: current.guests }) : tListings(`unitCount.${current.unit}`, { count: current.quantity })}
                </span>
              </span>
            </Link>
            <div className="grid grid-cols-2 gap-2 p-3">
              <Link href="/my-stay" className="col-span-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-hover">
                <KeyRound className="size-4" aria-hidden="true" />
                {t("openMyStay")}
              </Link>
              <a href={directionsUrl(current.listing.lat, current.listing.lng)} target="_blank" rel="noopener noreferrer" className={`${pillLink} justify-center`}>
                <Navigation className="size-4" aria-hidden="true" />
                {t("directions")}
              </a>
              <Link href={{ pathname: "/support", query: { booking: current.reference } }} className={`${pillLink} justify-center`}>
                <LifeBuoy className="size-4" aria-hidden="true" />
                {t("getHelp")}
              </Link>
            </div>
          </div>
        ) : (
          <div className={`${card} flex items-center gap-4 p-5`}>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.08] text-primary">
              <MapPin className="size-6" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[15px] font-semibold text-ink">{t("noActiveStay")}</p>
              <p className="text-[13px] text-muted">{t("noActiveStayBody")}</p>
            </div>
          </div>
        )}
      </section>

      <section className="mt-8">
        {bookings.length === 0 ? (
          <EmptyState
            icon={<House />}
            title={tEmpty("bookingsTitle")}
            body={tEmpty("bookingsBody")}
            action={
              <Link
                href="/"
                className="inline-flex items-center rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-transform active:scale-[0.97]"
              >
                {tFooter("startSearching")}
              </Link>
            }
          />
        ) : (
          <BookingsTabs
            upcoming={upcoming}
            past={past}
            labels={{ upcoming: t("upcoming"), past: t("past"), noUpcoming: t("noUpcoming"), noPast: t("noPast"), group: tNav("bookings"), findPlace: tFooter("startSearching") }}
          />
        )}
      </section>
    </PageContainer>
  );
}
