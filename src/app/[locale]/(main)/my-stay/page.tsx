import {
  BedDouble,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Clock,
  KeyRound,
  LogOut,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Receipt,
  ScrollText,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { MessageHostButton } from "@/features/chats/components/MessageHostButton";
import { directionsUrl, formatKigaliTime } from "@/features/bookings/format";
import type { PolicySnapshot } from "@/features/bookings/service";
import { ordersLive } from "@/features/food/service";
import { policyText } from "@/features/settings/service";
import { GuestIdUpload } from "@/features/stay/components/GuestIdUpload";
import { ReportIssue } from "@/features/stay/components/ReportIssue";
import { StayFeedback } from "@/features/stay/components/StayFeedback";
import { StayRequests } from "@/features/stay/components/StayRequests";
import { stayMoment } from "@/features/stay/moment";
import { myStay } from "@/features/stay/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { requireUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("MyStay");
  return { title: t("title") };
}

const card = "rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line";

/** A section as one tappable row; its content opens below. */
function Fold({ title, icon: Icon, badge, open = false, children }: { title: string; icon: LucideIcon; badge?: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="flex-1 text-[15px] font-semibold text-ink">{title}</span>
        {badge}
        <ChevronRight className="size-4 shrink-0 text-ink/50 transition-transform group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

const action = "flex flex-col items-center justify-center gap-1 rounded-2xl bg-surface px-1 py-2.5 text-center text-[12px] font-semibold text-ink ring-1 ring-line transition-colors hover:ring-primary active:scale-[0.97]";

/**
 * MY STAY: what the guest needs right now. A status line for today (pay, days to go, check-in, night N, check-out),
 * one-tap actions, the booking at a glance, then ID, house rules, changes, feedback and help.
 */
export default async function MyStayPage() {
  const user = await requireUser("/my-stay");
  const [t, locale, { current, others, today }] = await Promise.all([getTranslations("MyStay"), getLocale(), myStay(user.id)]);

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
  const moment = stayMoment(current, today);
  const underWay = moment.kind === "during" || moment.kind === "departure" || (paid && moment.kind === "arrival");
  const { listing } = current;
  const hourly = current.unit === "HOUR";
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const inTime = hourly ? formatKigaliTime(locale, current.startAt) : policy.checkInTime;
  const outTime = hourly ? formatKigaliTime(locale, current.endAt) : policy.checkOutTime;
  const cancellation = policyText(policy.cancellationPolicy, locale);

  // Today's status line.
  const status = (() => {
    switch (moment.kind) {
      case "unpaid":
        return {
          tone: "bg-amber-50 text-amber-950 ring-amber-200",
          icon: CircleAlert,
          title: t("moment.unpaid"),
          sub: current.holdExpiresAt ? t("moment.unpaidSub", { time: formatKigaliTime(locale, current.holdExpiresAt) }) : "",
        };
      case "upcoming":
        return {
          tone: "bg-primary/[0.07] text-ink ring-primary/15",
          icon: CalendarClock,
          title: t("moment.upcoming", { days: moment.days }),
          sub: inTime ? t("moment.checkInOn", { day: day(current.checkIn), time: inTime }) : day(current.checkIn),
        };
      case "arrival":
        return { tone: "bg-emerald-50 text-emerald-950 ring-emerald-200", icon: KeyRound, title: t("moment.arrival"), sub: inTime ? t("moment.fromTime", { time: inTime }) : "" };
      case "during":
        return {
          tone: "bg-primary/[0.07] text-ink ring-primary/15",
          icon: BedDouble,
          title: t("moment.during", { day: moment.day, total: moment.total }),
          sub: outTime ? t("moment.checkOutOn", { day: day(current.checkOut), time: outTime }) : day(current.checkOut),
        };
      case "departure":
        return { tone: "bg-amber-50 text-amber-950 ring-amber-200", icon: LogOut, title: t("moment.departure"), sub: outTime ? t("moment.byTime", { time: outTime }) : "" };
    }
  })();
  const StatusIcon = status.icon;

  return (
    <PageContainer className="max-w-2xl pt-4 pb-8 md:py-10">
      <h1 className="mb-3 text-[24px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("title")}</h1>

      <div className="flex flex-col gap-3">
        {/* The place and today's status */}
        <section className={cn(card, "overflow-hidden")}>
          <div className="relative h-32 bg-canvas md:h-44">
            {listing.photos[0] && <Image src={listing.photos[0].url} alt="" fill sizes="(min-width: 768px) 672px, 100vw" className="object-cover" priority />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-4 pb-3 text-white">
              <h2 className="truncate text-[18px] leading-6 font-bold md:text-[22px] md:leading-7">{listing.title}</h2>
              <p className="truncate text-[12px] text-white/85">
                {current.room ? `${current.room.name} · ` : ""}
                {listing.district}, {listing.city}
              </p>
            </div>
          </div>
          <div className="p-3 md:p-4">
            <div className={cn("flex items-start gap-3 rounded-2xl px-3.5 py-3 ring-1", status.tone)}>
              <StatusIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-5 font-bold">{status.title}</p>
                {status.sub && <p className="text-[13px] opacity-80">{status.sub}</p>}
                {moment.kind === "during" && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((moment.day / moment.total) * 100)}%` }} />
                  </div>
                )}
              </div>
            </div>
            {moment.kind === "unpaid" && (
              <Link
                href={`/bookings/${current.reference}`}
                className="mt-2.5 flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-primary-hover"
              >
                {t("payNow")}
              </Link>
            )}

            {/* The booking at a glance */}
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
              <div className="rounded-xl bg-canvas px-3 py-2">
                <dt className="text-muted">{t("checkInLabel")}</dt>
                <dd className="font-semibold text-ink">
                  {day(current.checkIn)}
                  {inTime && <span className="font-normal text-muted"> · {inTime}</span>}
                </dd>
              </div>
              <div className="rounded-xl bg-canvas px-3 py-2">
                <dt className="text-muted">{t("checkOutLabel")}</dt>
                <dd className="font-semibold text-ink">
                  {day(current.checkOut)}
                  {outTime && <span className="font-normal text-muted"> · {outTime}</span>}
                </dd>
              </div>
              <div className="rounded-xl bg-canvas px-3 py-2">
                <dt className="text-muted">{t("guests")}</dt>
                <dd className="font-semibold text-ink">{current.guests}</dd>
              </div>
              <div className="rounded-xl bg-canvas px-3 py-2">
                <dt className="text-muted">{t("total")}</dt>
                <dd className="flex flex-wrap items-center gap-1.5 font-semibold text-ink tabular-nums">
                  {formatRWF(current.total, locale)}
                  <span className={cn("rounded-full px-1.5 py-px text-[10px] font-bold", paid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>{paid ? t("paid") : t("unpaid")}</span>
                </dd>
              </div>
            </dl>
            {current.refundStatus !== "NONE" && (
              <p className="mt-2 rounded-xl bg-primary-soft px-3 py-2 text-[13px] text-ink">{t(`refund.${current.refundStatus}`, { amount: formatRWF(current.refundAmount ?? 0, locale) })}</p>
            )}
            <div className="mt-2 flex items-center justify-between gap-3 text-[13px]">
              <a href={directionsUrl(listing.lat, listing.lng)} target="_blank" rel="noopener" className="inline-flex min-w-0 items-center gap-1 text-ink hover:text-primary">
                <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">{listing.addressLine}</span>
              </a>
              <Link href={`/bookings/${current.reference}`} className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-primary">
                <span className="font-mono">{current.reference}</span>
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* One-tap actions */}
        <nav aria-label={t("quickActions")} className="grid grid-cols-4 gap-2">
          <a href={directionsUrl(listing.lat, listing.lng)} target="_blank" rel="noopener" className={action}>
            <Navigation className="size-5 text-primary" aria-hidden="true" />
            {t("directions")}
          </a>
          <MessageHostButton listingId={listing.id} signedIn className={cn(action, "w-full")}>
            <MessageSquare className="size-5 text-primary" aria-hidden="true" />
            {t("message")}
          </MessageHostButton>
          {listing.host.phone ? (
            <a href={`tel:${listing.host.phone}`} className={action}>
              <Phone className="size-5 text-primary" aria-hidden="true" />
              {t("callHost")}
            </a>
          ) : (
            <Link href={{ pathname: "/support", query: { booking: current.reference } }} className={action}>
              <Phone className="size-5 text-primary" aria-hidden="true" />
              {t("help")}
            </Link>
          )}
          {food && paid ? (
            <Link href="/restaurants" className={action}>
              <UtensilsCrossed className="size-5 text-primary" aria-hidden="true" />
              {t("food")}
            </Link>
          ) : (
            <Link href={`/bookings/${current.reference}`} className={action}>
              <Receipt className="size-5 text-primary" aria-hidden="true" />
              {t("receipt")}
            </Link>
          )}
        </nav>

        {/* Everything else: one line each, opened with a tap. */}
        <div className={cn(card, "divide-y divide-line")}>
          {listing.guestIdPolicy !== "NONE" && (
            <Fold
              title={t("idTitle")}
              icon={KeyRound}
              open={listing.guestIdPolicy === "UPLOAD_ONLINE" && !current.guestDocument}
              badge={
                listing.guestIdPolicy === "UPLOAD_ONLINE" ? (
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", current.guestDocument ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>
                    {current.guestDocument ? t("idDone") : t("idNeeded")}
                  </span>
                ) : null
              }
            >
              {listing.guestIdPolicy === "UPLOAD_ONLINE" ? (
                <GuestIdUpload reference={current.reference} uploaded={current.guestDocument?.filename ?? null} />
              ) : (
                <p className="text-[14px] text-muted">{t("idAtCheckIn")}</p>
              )}
            </Fold>
          )}

          {(policy.houseRules.length > 0 || cancellation) && (
            <Fold title={t("rulesTitle")} icon={ScrollText}>
              {policy.houseRules.length > 0 && (
                <ul className="flex flex-col gap-1.5 text-[14px] text-ink">
                  {policy.houseRules.map((rule) => (
                    <li key={rule} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                      {rule}
                    </li>
                  ))}
                </ul>
              )}
              {cancellation && (
                <p className="mt-3 text-[14px] whitespace-pre-line text-muted">
                  <b className="font-semibold text-ink">{t("cancellationTerms")}: </b>
                  {cancellation}
                </p>
              )}
            </Fold>
          )}

          <Fold
            title={t("changeTitle")}
            icon={Clock}
            open={current.requests.some((r) => r.status === "PENDING")}
            badge={current.requests.some((r) => r.status === "PENDING") ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">{t("requestStatus.PENDING")}</span> : null}
          >
            <StayRequests
              reference={current.reference}
              checkIn={current.checkIn}
              checkOut={current.checkOut}
              today={today}
              paid={paid}
              canCancel={current.status === "CONFIRMED" && current.checkIn > today}
              requests={current.requests}
            />
          </Fold>

          {underWay && (
            <Fold title={t("feedbackTitle")} icon={BedDouble}>
              <StayFeedback reference={current.reference} initial={current.feedback} />
            </Fold>
          )}

          <Fold title={t("issueTitle")} icon={CircleAlert}>
            <p className="mb-3 text-[14px] text-muted">{t("issueIntro")}</p>
            <ReportIssue reference={current.reference} />
          </Fold>

          {others.length > 0 && (
            <Fold title={t("nextStays")} icon={CalendarClock} badge={<span className="text-[12px] font-semibold text-muted">{others.length}</span>}>
              <ul className="flex flex-col divide-y divide-line">
                {others.map((s) => (
                  <li key={s.reference}>
                    <Link href={`/bookings/${s.reference}`} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-ink">{s.listing.title}</span>
                        <span className="block text-[12px] text-muted">
                          {day(s.checkIn)} – {day(s.checkOut)}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-ink/50" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Fold>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
