import { CalendarDays, ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { formatStayDates } from "@/features/bookings/format";
import { can } from "@/features/places/access";
import { portalBookings } from "@/features/places/portal";
import { todayISO } from "@/features/search/date-range";
import { FrontDesk } from "@/features/stay/components/FrontDesk";
import { DecideRequest } from "@/features/stay/components/StaffStayPanels";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { requireUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("Portal");
  return { title: t("title") };
}

/** Owner portal: bookings at every place the person owns or helps run, with the front-desk actions their role allows. */
export default async function HostBookingsPage() {
  const user = await requireUser("/host/bookings");
  const [t, tBookings, tStay, tPlaces, locale, { rows, places }] = await Promise.all([
    getTranslations("Portal"),
    getTranslations("Bookings"),
    getTranslations("MyStay"),
    getTranslations("Places"),
    getLocale(),
    portalBookings(user.id),
  ]);
  const today = todayISO();
  const now = rows.filter((r) => r.status === "CHECKED_IN" || (r.status === "CONFIRMED" && r.checkIn <= today && r.checkOut >= today));
  const upcoming = rows.filter((r) => !now.includes(r) && r.checkIn > today && (r.status === "CONFIRMED" || r.status === "PENDING_PAYMENT"));
  const past = rows.filter((r) => !now.includes(r) && !upcoming.includes(r)).reverse();

  const section = (title: string, list: typeof rows) =>
    list.length > 0 && (
      <section className="flex flex-col gap-3">
        <h2 className="text-[17px] font-bold text-ink">{title}</h2>
        <ul className="flex flex-col gap-3">
          {list.map((b) => (
            <li key={b.reference} className="rounded-3xl bg-surface p-4 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span>
                  <span className="block text-[15px] font-semibold text-ink">{b.guest.name}</span>
                  <span className="block text-[13px] text-muted">
                    {b.listing.title}
                    {b.room && ` · ${b.room.name}`} · {formatStayDates(locale, b.checkIn, b.checkOut)}
                  </span>
                  <span className="block font-mono text-xs text-muted">
                    {b.reference} · {tPlaces(`portalRole.${b.role}`)}
                    {can(b.role, "money") && ` · ${formatRWF(b.total, locale)}`}
                  </span>
                </span>
                <StatusBadge status={b.status} label={tBookings(`status.${b.status}`)} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {can(b.role, "checkIn") && <FrontDesk reference={b.reference} status={b.status} checkIn={b.checkIn} today={today} />}
                {b.guest.phone && (
                  <a href={`tel:${b.guest.phone}`} className="text-[13px] font-semibold text-primary hover:underline">
                    {b.guest.phone}
                  </a>
                )}
                {b.guestDocument && can(b.role, "guestId") && (
                  <a href={`/api/v1/bookings/${b.reference}/guest-id`} target="_blank" rel="noopener" className="text-[13px] font-semibold text-primary hover:underline">
                    {t("guestId")}
                  </a>
                )}
              </div>
              {b.requests.length > 0 && can(b.role, "requests") && (
                <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-amber-50/70 p-3">
                  {b.requests.map((r) => (
                    <div key={r.id} className="text-[14px]">
                      <b className="font-semibold">{tStay(`kind.${r.kind}`)}</b>
                      {r.transferTo && ` · ${r.transferTo}`}
                      <span className="block text-[13px] text-muted">{r.reason}</span>
                      <DecideRequest requestId={r.id} kind={r.kind} total={b.total} suggestedRefund={r.kind === "CANCEL" ? b.total : null} />
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    );

  return (
    <PageContainer className="max-w-3xl py-6 md:py-10">
      <Link href="/host" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <h1 className="mb-1 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("title")}</h1>
      <p className="mb-6 text-[15px] text-muted">{t("intro", { count: places })}</p>
      {rows.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <div className={cn("flex flex-col gap-8")}>
          {section(t("now"), now)}
          {section(t("upcoming"), upcoming)}
          {section(t("recent"), past)}
        </div>
      )}
    </PageContainer>
  );
}
