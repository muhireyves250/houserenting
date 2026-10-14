import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { formatKigaliDateTime, formatStayDates } from "@/features/bookings/format";
import { isBookingReference } from "@/features/bookings/reference";
import { guestBookings } from "@/features/bookings/service";
import { NewTicketForm } from "@/features/support/components/NewTicketForm";
import { TicketStatusBadge } from "@/features/support/components/TicketStatusBadge";
import { myTickets } from "@/features/support/service";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/session";

type Props = { searchParams: Promise<{ booking?: string }> };
const card = "rounded-3xl bg-surface p-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line md:p-6";

export default async function SupportPage({ searchParams }: Props) {
  const user = await requireUser("/support");
  const booking = (await searchParams).booking;
  const [t, locale, tickets, bookings] = await Promise.all([getTranslations("Support"), getLocale(), myTickets(user.id), guestBookings(user.id)]);
  const preset = booking && isBookingReference(booking) && bookings.some((b) => b.reference === booking) ? booking : null;

  return (
    <PageContainer className="max-w-3xl py-6 md:py-10">
      <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("title")}</h1>
      <p className="mt-1 mb-6 text-[15px] text-muted">{t("intro")}</p>

      <section className={card}>
        <h2 className="mb-4 text-lg font-bold text-ink">{t("new")}</h2>
        <NewTicketForm
          bookingReference={preset}
          bookings={bookings.slice(0, 20).map((b) => ({ reference: b.reference, label: `${b.reference} · ${b.listing.title} · ${formatStayDates(locale, b.checkIn, b.checkOut)}` }))}
        />
      </section>

      {tickets.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-ink">{t("yours")}</h2>
          <ul className="flex flex-col gap-3">
            {tickets.map((ticket) => (
              <li key={ticket.reference}>
                <Link href={`/support/${ticket.reference}`} className={`${card} flex items-center gap-4 !p-4 transition-transform duration-300 active:scale-[0.98]`}>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <TicketStatusBadge status={ticket.status} label={t(`status.${ticket.status}`)} />
                      <span className="font-mono text-xs text-muted">{ticket.reference}</span>
                    </span>
                    <span className="truncate text-[15px] font-semibold text-ink">{ticket.subject}</span>
                    <span className="text-[13px] text-muted">
                      {t(`categories.${ticket.category}`)} · {formatKigaliDateTime(locale, ticket.updatedAt)}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-ink/50" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageContainer>
  );
}
