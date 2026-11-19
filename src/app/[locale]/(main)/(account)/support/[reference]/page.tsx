import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { isTicketReference } from "@/features/bookings/reference";
import { ReplyBox } from "@/features/support/components/ReplyBox";
import { TicketStatusBadge } from "@/features/support/components/TicketStatusBadge";
import { TicketThread } from "@/features/support/components/TicketThread";
import { getMyTicket } from "@/features/support/service";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/session";

type Props = { params: Promise<{ reference: string }> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function TicketPage({ params }: Props) {
  const { reference } = await params;
  const user = await requireUser(`/support/${reference}`);
  if (!isTicketReference(reference)) notFound();
  const ticket = await getMyTicket(user.id, reference);
  if (!ticket) notFound();
  const [t, locale] = await Promise.all([getTranslations("Support"), getLocale()]);

  return (
    <PageContainer className="max-w-3xl py-6 md:py-10">
      <Link href="/support" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("title")}
      </Link>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] leading-7 font-bold tracking-[-0.02em] text-ink md:text-[26px] md:leading-8">{ticket.subject}</h1>
        <TicketStatusBadge status={ticket.status} label={t(`status.${ticket.status}`)} />
      </div>
      <p className="mb-6 text-[13px] text-muted">
        <span className="font-mono">{ticket.reference}</span> · {t(`categories.${ticket.category}`)}
        {ticket.bookingReference && (
          <>
            {" · "}
            <Link href={`/bookings/${ticket.bookingReference}`} className="text-primary hover:underline">
              {ticket.bookingReference}
            </Link>
          </>
        )}
      </p>
      <TicketThread messages={ticket.messages} locale={locale} viewerIsStaff={false} staffLabel={t("staff")} />
      <div className="mt-6">{ticket.status === "CLOSED" ? <p className="text-center text-[15px] text-muted">{t("closedNote")}</p> : <ReplyBox reference={ticket.reference} />}</div>
    </PageContainer>
  );
}
