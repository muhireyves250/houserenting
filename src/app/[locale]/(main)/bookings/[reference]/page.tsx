import { ChevronLeft, House, LifeBuoy, MessageSquare, Navigation } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageContainer } from "@/components/ui/PageContainer";
import { CancelBooking } from "@/features/bookings/components/CancelBooking";
import { PrintReceipt } from "@/features/bookings/components/PrintReceipt";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { directionsUrl, formatDay, formatKigaliDateTime, formatKigaliTime, formatStayDates } from "@/features/bookings/format";
import { isBookingReference } from "@/features/bookings/reference";
import { getGuestBooking } from "@/features/bookings/service";
import { isHoldActive } from "@/features/bookings/status";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { ReviewForm } from "@/features/reviews/components/ReviewForm";
import { canReview } from "@/features/reviews/service";
import { policyText } from "@/features/settings/service";
import { PayNow } from "@/features/payments/components/PayNow";
import { MessageHostButton } from "@/features/chats/components/MessageHostButton";
import { getPaymentProvider } from "@/features/payments/providers";

type Props = { params: Promise<{ reference: string }> };

// Booking pages are private: keep them out of search engines.
export const metadata: Metadata = { robots: { index: false, follow: false } };

const card = "rounded-3xl bg-surface p-6 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line print:shadow-none";
const pillLink =
  "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink transition-[background-color,transform] duration-300 hover:bg-canvas active:scale-95 max-md:border-primary max-md:text-primary print:hidden";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-[15px] text-muted">{label}</dt>
      <dd className="text-right text-[15px] font-medium text-ink">{children}</dd>
    </div>
  );
}

export default async function BookingPage({ params }: Props) {
  const { reference } = await params;
  const user = await requireUser(`/bookings/${reference}`);
  if (!isBookingReference(reference)) notFound();
  const now = new Date();
  const booking = await getGuestBooking(user.id, reference, now);
  if (!booking) notFound();

  const [t, tListings, tType, tReviews, locale, reviewable] = await Promise.all([
    getTranslations("Bookings"),
    getTranslations("Listings"),
    getTranslations("ListingType"),
    getTranslations("Reviews"),
    getLocale(),
    canReview(user.id, reference),
  ]);
  const { listing, policySnapshot: policy } = booking;
  const holding = isHoldActive(booking, now);
  const paid = booking.payments.length > 0 || ["CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(booking.status);
  const live = holding || booking.status === "CONFIRMED" || booking.status === "CHECKED_IN";
  const methodName = booking.paymentMethod === "mtn" ? tListings("mtnMomo") : booking.paymentMethod === "airtel" ? tListings("airtelMoney") : null;

  return (
    <PageContainer className="max-w-3xl pt-6 pb-10 md:py-10">
      <Link href="/bookings" className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink print:hidden">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>

      {/* The place and where the booking stands */}
      <section className={cn(card, "flex flex-col gap-5 p-4 md:flex-row md:items-center md:p-5")}>
        <span className="relative flex aspect-[4/3] w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary md:size-32 md:aspect-auto">
          {listing.photos[0] ? (
            <Image src={listing.photos[0].url} alt="" fill sizes="(min-width: 768px) 128px, 100vw" className="object-cover" priority />
          ) : (
            <House className="size-8" aria-hidden="true" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <StatusBadge status={booking.status} label={t(`status.${booking.status}`)} className="self-start" />
          <h1 className="text-[22px] leading-7 font-bold tracking-[-0.02em] text-ink">{listing.title}</h1>
          <p className="text-[13px] text-muted">
            {tType(listing.type)} · {listing.addressLine}, {listing.district}, {listing.city}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href={`/listings/${listing.id}`} className={pillLink}>
              {t("viewPlace")}
            </Link>
            {live && (
              <a href={directionsUrl(listing.lat, listing.lng)} target="_blank" rel="noopener noreferrer" className={pillLink}>
                <Navigation className="size-4" aria-hidden="true" />
                {t("directions")}
              </a>
            )}
            <MessageHostButton listingId={listing.id} signedIn className={pillLink}>
              <MessageSquare className="size-4" aria-hidden="true" />
              {t("messageHost")}
            </MessageHostButton>
            <Link href={{ pathname: "/support", query: { booking: booking.reference } }} className={pillLink}>
              <LifeBuoy className="size-4" aria-hidden="true" />
              {t("getHelp")}
            </Link>
          </div>
        </div>
      </section>

      {holding && booking.holdExpiresAt && (
        <section className={cn(card, "mt-4 print:hidden")}>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-ink">{t("payTitle")}</h2>
            <p className="text-[13px] font-semibold text-amber-800">{t("heldUntil", { time: formatKigaliTime(locale, booking.holdExpiresAt) })}</p>
          </div>
          <PayNow
            reference={booking.reference}
            amount={booking.total}
            method={booking.paymentMethod === "airtel" ? "airtel" : booking.paymentMethod === "mtn" ? "mtn" : null}
            connected={getPaymentProvider() !== null}
          />
        </section>
      )}

      {/* Your stay */}
      <section className={cn(card, "mt-4")}>
        <h2 className="mb-2 text-lg font-bold text-ink">{t("yourStay")}</h2>
        <dl className="divide-y divide-line">
          {booking.unit === "HOUR" && (
            <Row label={t("time")}>
              {new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" }).formatRange(booking.startAt, booking.endAt)}
            </Row>
          )}
          <Row label={tListings("checkInLabel")}>
            {formatDay(locale, booking.checkIn)}
            {policy.checkInTime && <span className="block text-[13px] font-normal text-muted">{tListings("checkIn", { time: policy.checkInTime })}</span>}
          </Row>
          <Row label={tListings("checkOutLabel")}>
            {formatDay(locale, booking.checkOut)}
            {policy.checkOutTime && <span className="block text-[13px] font-normal text-muted">{tListings("checkOut", { time: policy.checkOutTime })}</span>}
          </Row>
          <Row label={tListings("guestsLabel")}>{tListings("statGuests", { count: booking.guests })}</Row>
        </dl>
      </section>

      {/* Electronic receipt */}
      <section id="receipt" className={cn(card, "mt-4")}>
        <div className="mb-2 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-ink">{t("receipt")}</h2>
          <PrintReceipt label={t("print")} />
        </div>
        <dl className="divide-y divide-line tabular-nums">
          <Row label={t("reference")}>
            <span className="font-mono tracking-wider">{booking.reference}</span>
          </Row>
          <Row label={tListings("dates")}>{formatStayDates(locale, booking.checkIn, booking.checkOut)}</Row>
          {booking.room && <Row label={t("room")}>{booking.room.name}</Row>}
          {booking.rentalMode === "MONTHLY" && booking.months && (
            <Row label={t("rental")}>{t("rentalTerms", { months: booking.months, upfront: booking.upfrontMonths ?? booking.months })}</Row>
          )}
          <Row
            label={tListings(`unitTimes.${booking.unit}`, {
              price: formatRWF(booking.nightlyPrice, locale),
              count: booking.unit === "MONTH" ? (booking.upfrontMonths ?? booking.quantity) : booking.quantity,
            })}
          >
            {formatRWF(booking.subtotal || booking.total, locale)}
          </Row>
          {booking.discount > 0 && (
            <Row label={tListings("promoLine", { code: booking.promoCode?.code ?? "" })}>−{formatRWF(booking.discount, locale)}</Row>
          )}
          {booking.deposit > 0 && <Row label={tListings("depositDue")}>{formatRWF(booking.deposit, locale)}</Row>}
          {booking.guestFee > 0 && <Row label={t("serviceFee")}>{formatRWF(booking.guestFee, locale)}</Row>}
          <Row label={`${t("amount")} (${booking.currency})`}>
            <span className="font-bold">{formatRWF(booking.total, locale)}</span>
          </Row>
          {methodName && (
            <Row label={t("paymentMethod")}>
              {methodName}
              {booking.payerPhone && <span className="block text-[13px] font-normal text-muted">{booking.payerPhone}</span>}
            </Row>
          )}
          <Row label={t("paymentStatus")}>{paid ? t("paid") : t("unpaid")}</Row>
          <Row label={t("transactionRef")}>
            {booking.payments[0] ? <span className="font-mono">{booking.payments[0].providerReference}</span> : t("notYet")}
          </Row>
        </dl>
        <p className="mt-3 text-[13px] text-muted">{t("bookedOn", { date: formatKigaliDateTime(locale, booking.createdAt) })}</p>
      </section>

      {/* What the guest agreed to, as it was at booking time */}
      <section className={cn(card, "mt-4")}>
        <h2 className="mb-3 text-lg font-bold text-ink">{t("agreed")}</h2>
        <h3 className="mb-1.5 text-[15px] font-semibold text-ink">{tListings("houseRules")}</h3>
        <ul className="mb-4 flex flex-col gap-1 text-[15px] text-ink/80">
          {policy.checkInTime && <li>{tListings("checkIn", { time: policy.checkInTime })}</li>}
          {policy.checkOutTime && <li>{tListings("checkOut", { time: policy.checkOutTime })}</li>}
          {policy.houseRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <h3 className="mb-1.5 text-[15px] font-semibold text-ink">{tListings("cancellation")}</h3>
        <p className="text-[15px] whitespace-pre-line text-ink/80">
          {policyText(policy.cancellationPolicy, locale) ?? `${tListings("cancelWhileUnpaid")} ${t("cancelPaid")}`}
        </p>
      </section>

      {/* Status history */}
      <section className={cn(card, "mt-4")}>
        <h2 className="mb-4 text-lg font-bold text-ink">{t("timeline")}</h2>
        <ol className="relative flex flex-col gap-5 border-l-2 border-line pl-6">
          {booking.events.map((event, index) => (
            <li key={index} className="relative">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-1 -left-[31px] size-3.5 rounded-full ring-4 ring-surface",
                  index === booking.events.length - 1 ? "bg-primary" : "bg-line-strong",
                )}
              />
              <p className="text-[15px] font-semibold text-ink">{t(`event.${event.toStatus}`)}</p>
              <p className="text-[13px] text-muted">{formatKigaliDateTime(locale, event.createdAt)}</p>
            </li>
          ))}
        </ol>
      </section>

      {reviewable && (
        <section className={cn(card, "mt-4 print:hidden")}>
          <h2 className="mb-3 text-lg font-bold text-ink">{tReviews("leave")}</h2>
          <ReviewForm reference={booking.reference} />
        </section>
      )}

      {holding && (
        <div className="mt-6 print:hidden">
          <CancelBooking reference={booking.reference} />
        </div>
      )}
    </PageContainer>
  );
}
