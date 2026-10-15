import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { TicketStatusSelect } from "@/features/admin/components/StaffButtons";
import { recentAudit } from "@/features/audit/service";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { isTicketReference } from "@/features/bookings/reference";
import { ReplyBox } from "@/features/support/components/ReplyBox";
import { TicketThread } from "@/features/support/components/TicketThread";
import { staffTicket } from "@/features/support/service";
import { requireAdmin } from "@/lib/permissions";
import { dynamicMessage } from "@/lib/dynamic-message";

type Props = { params: Promise<{ reference: string }> };

export default async function AdminTicketPage({ params }: Props) {
  const { reference } = await params;
  await requireAdmin(`/admin/support/${reference}`);
  if (!isTicketReference(reference)) notFound();
  const ticket = await staffTicket(reference);
  if (!ticket) notFound();
  const [t, tAdmin, locale, history] = await Promise.all([
    getTranslations("Support"),
    getTranslations("Admin"),
    getLocale(),
    recentAudit({ entityType: "ticket", entityId: reference, take: 50 }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[22px] leading-7 font-bold text-ink">{ticket.subject}</h2>
          <p className="text-[13px] text-muted">
            {ticket.reference} · {t(`categories.${ticket.category}`)} · {ticket.user.name} · {ticket.user.email}
            {ticket.user.phone && ` · ${ticket.user.phone}`}
            {ticket.bookingReference && ` · ${ticket.bookingReference}`}
          </p>
        </div>
        <TicketStatusSelect reference={ticket.reference} status={ticket.status} />
      </div>
      <TicketThread messages={ticket.messages} locale={locale} viewerIsStaff staffLabel={t("staff")} />
      {ticket.status !== "CLOSED" && <ReplyBox reference={ticket.reference} />}
      <section className="rounded-3xl bg-surface p-5 ring-1 ring-line">
        <h3 className="mb-2 text-[15px] font-semibold text-ink">{tAdmin("history")}</h3>
        <ol className="flex flex-col gap-1.5 text-[13px]">
          {history.map((entry) => {
            const change = entry.data as { from?: string; to?: string } | null;
            return (
              <li key={entry.id} className="flex flex-wrap justify-between gap-2">
                <span className="text-ink">
                  <b className="font-semibold">{dynamicMessage(tAdmin, `action.${entry.action}`, entry.action)}</b> · {entry.actor?.name ?? tAdmin("system")}
                  {change?.from && change.to && (
                    <span className="text-muted">
                      {" "}
                      · {dynamicMessage(t, `status.${change.from}`, change.from)} → {dynamicMessage(t, `status.${change.to}`, change.to)}
                    </span>
                  )}
                </span>
                <span className="text-muted">{formatKigaliDateTime(locale, entry.createdAt)}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
