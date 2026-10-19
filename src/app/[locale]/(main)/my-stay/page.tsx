import { BedDouble, ChevronRight, KeyRound, MapPin, MessageSquare, Navigation } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { MessageHostButton } from "@/features/chats/components/MessageHostButton";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { directionsUrl, formatStayDates } from "@/features/bookings/format";
import type { PolicySnapshot } from "@/features/bookings/service";
import { Card } from "@/features/hosting/components/fields";
import { GuestIdUpload } from "@/features/stay/components/GuestIdUpload";
import { ReportIssue } from "@/features/stay/components/ReportIssue";
import { StayFeedback } from "@/features/stay/components/StayFeedback";
import { StayRequests } from "@/features/stay/components/StayRequests";
import { myStay } from "@/features/stay/service";
import { ordersLive } from "@/features/food/service";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { requireUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("MyStay");
  return { title: t("title") };
}

/** MY STAY: everything about the stay under way (or the next one) in one place. */
export default async function MyStayPage() {
  const user = await requireUser("/my-stay");
  const [t, tBookings, locale, { current, others, today }] = await Promise.all([getTranslations("MyStay"), getTranslations("Bookings"), getLocale(), myStay(user.id)]);

  if (!current) {
    return (
      <PageContainer className="max-w-2xl py-6 md:py-10">
        <h1 className="mb-6 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("title")}</h1>
        <EmptyState
          icon={<KeyRound />}
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <Link href="/" className="inline-flex items-center rounded-xl bg-primary px-7 py-3 text-[15px] font-semibold text-white">
              {t("findPlace")}
            </Link>
          }
        />
      </PageContainer>
    );
  }

  const policy = current.policySnapshot as PolicySnapshot;
  const food = await ordersLive();
  const paid = current.status === "CONFIRMED" || current.status === "CHECKED_IN";
  const underWay = current.status === "CHECKED_IN" || (paid && current.checkIn <= today);
  const { listing } = current;

  return (
    <PageContainer className="max-w-2xl py-6 md:py-10">
      <h1 className="mb-1 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("title")}</h1>
      <p className="mb-5 text-[15px] text-muted">{underWay ? t("underWay") : t("comingUp")}</p>

      <div className="flex flex-col gap-4">
        <section className="overflow-hidden rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
          {listing.photos[0] && (
            <div className="relative aspect-[16/7] bg-canvas">
              <Image src={listing.photos[0].url} alt="" fill sizes="(min-width: 768px) 672px, 100vw" className="object-cover" priority />
            </div>
          )}
          <div className="flex flex-col gap-3 p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[20px] leading-7 font-bold text-ink">{listing.title}</h2>
              <StatusBadge status={current.status} label={tBookings(`status.${current.status}`)} />
            </div>
            {current.room && (
              <p className="inline-flex items-center gap-2 text-[14px] text-ink">
                <BedDouble className="size-4 text-primary" aria-hidden="true" />
                {current.room.name}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-canvas p-4 text-[14px]">
              <div>
                <dt className="text-xs font-semibold text-muted">{t("dates")}</dt>
                <dd className="font-semibold text-ink">{formatStayDates(locale, current.checkIn, current.checkOut)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">{t("reference")}</dt>
                <dd className="font-mono font-semibold text-ink">{current.reference}</dd>
              </div>
              {policy.checkInTime && (
                <div>
                  <dt className="text-xs font-semibold text-muted">{t("checkIn")}</dt>
                  <dd className="text-ink">{policy.checkInTime}</dd>
                </div>
              )}
              {policy.checkOutTime && (
                <div>
                  <dt className="text-xs font-semibold text-muted">{t("checkOut")}</dt>
                  <dd className="text-ink">{policy.checkOutTime}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-semibold text-muted">{t("guests")}</dt>
                <dd className="text-ink">{current.guests}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-muted">{t("total")}</dt>
                <dd className="text-ink tabular-nums">{formatRWF(current.total, locale)}</dd>
              </div>
            </dl>
            <p className="inline-flex items-start gap-2 text-[14px] text-ink">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              {listing.addressLine}, {listing.district}, {listing.city}
            </p>
            {current.refundStatus !== "NONE" && (
              <p className="rounded-xl bg-primary-soft px-4 py-3 text-[14px] text-ink">
                {t(`refund.${current.refundStatus}`, { amount: formatRWF(current.refundAmount ?? 0, locale) })}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <a
                href={directionsUrl(listing.lat, listing.lng)}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-hover"
              >
                <Navigation className="size-4" aria-hidden="true" />
                {t("directions")}
              </a>
              <MessageHostButton
                listingId={listing.id}
                signedIn
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-[14px] font-semibold text-ink hover:border-primary"
              >
                <MessageSquare className="size-4" aria-hidden="true" />
                {t("messageHost", { name: listing.host.name })}
              </MessageHostButton>
              <Link
                href={`/bookings/${current.reference}`}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-4 py-2.5 text-[14px] font-semibold text-ink hover:border-primary"
              >
                {current.status === "PENDING_PAYMENT" ? t("payNow") : t("bookingDetails")}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {listing.guestIdPolicy !== "NONE" && (
          <Card title={t("idTitle")}>
            {listing.guestIdPolicy === "UPLOAD_ONLINE" ? (
              <GuestIdUpload reference={current.reference} uploaded={current.guestDocument?.filename ?? null} />
            ) : (
              <p className="text-[14px] text-muted">{t("idAtCheckIn")}</p>
            )}
          </Card>
        )}

        <Card title={t("changeTitle")}>
          <StayRequests
            reference={current.reference}
            checkIn={current.checkIn}
            checkOut={current.checkOut}
            today={today}
            paid={paid}
            canCancel={current.status === "CONFIRMED" && current.checkIn > today}
            requests={current.requests}
          />
        </Card>

        {underWay && (
          <Card title={t("feedbackTitle")}>
            <StayFeedback reference={current.reference} initial={current.feedback} />
          </Card>
        )}

        {food && underWay && (
          <Link href="/restaurants" className="flex items-center justify-between gap-3 rounded-3xl bg-primary px-5 py-4 text-white shadow-[0_10px_30px_-14px_rgba(0,87,184,0.6)]">
            <span>
              <span className="block text-[16px] font-bold">{t("orderFood")}</span>
              <span className="block text-[13px] text-white/85">{t("orderFoodBody")}</span>
            </span>
            <ChevronRight className="size-5" aria-hidden="true" />
          </Link>
        )}

        <Card title={t("issueTitle")}>
          <p className="-mt-2 mb-3 text-[14px] text-muted">{t("issueIntro")}</p>
          <ReportIssue reference={current.reference} />
        </Card>

        {others.length > 0 && (
          <Card title={t("nextStays")}>
            <ul className="flex flex-col divide-y divide-line">
              {others.map((s) => (
                <li key={s.reference}>
                  <Link href={`/bookings/${s.reference}`} className="flex items-center justify-between gap-3 py-3">
                    <span>
                      <span className="block text-[15px] font-semibold text-ink">{s.listing.title}</span>
                      <span className="block text-[13px] text-muted">{formatStayDates(locale, s.checkIn, s.checkOut)}</span>
                    </span>
                    <ChevronRight className="size-4 text-ink/50" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
