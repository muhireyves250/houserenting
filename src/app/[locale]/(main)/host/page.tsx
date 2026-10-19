import { ChevronRight, House, Plus } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { HostStatus } from "@/features/hosting/components/HostStatus";
import { hostListings } from "@/features/hosting/service";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { AnswerQuestion } from "@/features/questions/components/AnswerQuestion";
import { hostEarnings } from "@/features/ledger/service";
import { formatRWF } from "@/lib/format";
import { getLocale } from "next-intl/server";
import { hostQuestions } from "@/features/questions/service";

const newButton =
  "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-[#0a6fe0] px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-[filter,transform] duration-300 hover:brightness-110 active:scale-[0.97]";

export default async function HostPage() {
  const user = await requireUser("/host");
  const [t, tType, tPlaces, listings, questions, earnings, locale, restaurantRoles, helping] = await Promise.all([
    getTranslations("Host"),
    getTranslations("ListingType"),
    getTranslations("Places"),
    hostListings(user.id),
    hostQuestions(user.id),
    hostEarnings(user.id),
    getLocale(),
    db.restaurantMember.count({ where: { userId: user.id } }),
    db.placeMember.findMany({ where: { userId: user.id, listing: { status: { not: "ARCHIVED" } } }, select: { role: true, listing: { select: { id: true, title: true, city: true } } } }),
  ]);
  const hasMoney = earnings.earned + earnings.upcoming + earnings.paidOut > 0;

  return (
    <PageContainer className="max-w-3xl py-6 md:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("title")}</h1>
        {listings.length > 0 && (
          <Link href="/host/listings/new" className={newButton}>
            <Plus className="size-4" aria-hidden="true" />
            {t("newListing")}
          </Link>
        )}
      </div>

      {(listings.length > 0 || helping.length > 0) && (
        <Link
          href="/host/bookings"
          className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          {tPlaces("portalLink")}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      )}
      {(listings.length > 0 || restaurantRoles > 0) && (
        <Link
          href="/host/restaurants"
          className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-[14px] font-semibold text-ink ring-1 ring-line transition-colors hover:ring-primary"
        >
          {tPlaces("restaurantsLink")}
          <ChevronRight className="size-4 text-ink/50" aria-hidden="true" />
        </Link>
      )}
      {helping.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-[15px] font-semibold text-ink">{tPlaces("helpingTitle")}</h2>
          <ul className="flex flex-col divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
            {helping.map((h) => (
              <li key={h.listing.id}>
                <Link href={h.role === "MANAGER" ? `/host/listings/${h.listing.id}` : "/host/bookings"} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="block text-[14px] font-semibold text-ink">{h.listing.title}</span>
                    <span className="block text-xs text-muted">
                      {tPlaces(`teamRole.${h.role}`)} · {h.listing.city}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-ink/50" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {listings.length > 0 && (
        <Link
          href="/host/payout"
          className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3 text-[14px] font-semibold text-ink ring-1 ring-line transition-colors hover:ring-primary"
        >
          {t("payoutLink")}
          <ChevronRight className="size-4 text-ink/50" aria-hidden="true" />
        </Link>
      )}

      {listings.length === 0 ? (
        <EmptyState
          icon={<House />}
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <Link href="/host/listings/new" className={newButton}>
              <Plus className="size-4" aria-hidden="true" />
              {t("newListing")}
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {listings.map((listing) => (
            <li key={listing.id}>
              <Link
                href={`/host/listings/${listing.id}`}
                className="flex items-center gap-4 rounded-3xl bg-surface p-3 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] transition-transform duration-300 active:scale-[0.98] max-md:ring-line"
              >
                <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary">
                  {listing.photos[0] ? <Image src={listing.photos[0].url} alt="" fill sizes="80px" className="object-cover" /> : <House className="size-7" aria-hidden="true" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <HostStatus status={listing.status} label={t(`status.${listing.status}`)} className="self-start" />
                  <span className="truncate text-[15px] font-semibold text-ink">{listing.title}</span>
                  <span className="truncate text-[13px] text-muted">
                    {tType(listing.type)} · {listing.district}, {listing.city}
                  </span>
                  {(listing.status === "REJECTED" || listing.status === "CHANGES_REQUESTED") && listing.rejectionReason && (
                    <span className="text-xs font-medium text-red-800">{t("needsChanges", { reason: listing.rejectionReason })}</span>
                  )}
                </span>
                <ChevronRight className="size-5 shrink-0 text-ink/50" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {hasMoney && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold text-ink">{t("earnings")}</h2>
          <ul className="grid grid-cols-3 gap-3">
            {(
              [
                ["due", earnings.due],
                ["upcoming", earnings.upcoming],
                ["paidOut", earnings.paidOut],
              ] as const
            ).map(([key, value]) => (
              <li key={key} className="rounded-3xl bg-surface p-4 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
                <p className="text-lg font-bold text-ink tabular-nums">{formatRWF(value, locale)}</p>
                <p className="text-[13px] text-muted">{t(`earningsLabel.${key}`)}</p>
              </li>
            ))}
          </ul>
          {earnings.payouts.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1 text-[13px] text-ink/80 tabular-nums">
              {earnings.payouts.map((p) => (
                <li key={p.reference}>
                  {p.reference} · {formatRWF(p.amount, locale)}
                  {p.method && ` · ${p.method}`}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {questions.length > 0 && (
        <section id="questions" className="mt-10 scroll-mt-24">
          <h2 className="mb-3 text-lg font-bold text-ink">{t("questionsTitle")}</h2>
          <ul className="flex flex-col gap-3">
            {questions.map((q) => (
              <li key={q.id} className="rounded-3xl bg-surface p-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
                <p className="text-[13px] text-muted">{q.listing.title}</p>
                <p className="mt-1 text-[15px] font-semibold text-ink">{q.question}</p>
                <AnswerQuestion questionId={q.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
