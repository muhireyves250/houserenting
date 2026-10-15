import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { TicketStatusBadge } from "@/features/support/components/TicketStatusBadge";
import { staffTickets, type TicketStatus } from "@/features/support/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/permissions";
import { PageIntro } from "@/features/admin/components/ui";

type Props = { searchParams: Promise<{ status?: string }> };
const FILTERS: (TicketStatus | "active")[] = ["active", "RESOLVED", "CLOSED"];

export default async function AdminSupportPage({ searchParams }: Props) {
  await requireAdmin("/admin/support");
  const raw = (await searchParams).status;
  const status = raw === "RESOLVED" || raw === "CLOSED" ? raw : undefined;
  const [t, tAdmin, locale, tickets] = await Promise.all([getTranslations("Support"), getTranslations("Admin"), getLocale(), staffTickets(status)]);
  return (
    <div className="flex flex-col gap-4">
      <PageIntro description={tAdmin("supportIntro")} />
      <div className="flex gap-2">
        {FILTERS.map((f) => {
          const active = (status ?? "active") === f;
          return (
            <Link
              key={f}
              href={f === "active" ? "/admin/support" : { pathname: "/admin/support", query: { status: f } }}
              className={cn("rounded-full border px-3.5 py-1.5 text-[13px]", active ? "border-primary bg-primary/[0.08] font-semibold text-primary" : "border-line text-ink")}
            >
              {f === "active" ? tAdmin("activeTickets") : t(`status.${f}`)}
            </Link>
          );
        })}
      </div>
      {tickets.length === 0 && <p className="py-8 text-center text-[15px] text-muted">{tAdmin("nothingHere")}</p>}
      <ul className="flex flex-col gap-3">
        {tickets.map((ticket) => (
          <li key={ticket.reference}>
            <Link
              href={`/admin/support/${ticket.reference}`}
              className="flex items-center gap-4 rounded-3xl bg-surface p-4 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2">
                  <TicketStatusBadge status={ticket.status} label={t(`status.${ticket.status}`)} />
                  <span className="text-xs font-semibold text-ink/80">{t(`categories.${ticket.category}`)}</span>
                </span>
                <span className="truncate text-[15px] font-semibold text-ink">{ticket.subject}</span>
                <span className="truncate text-[13px] text-muted">
                  {ticket.user.name} · {ticket.reference} · {formatKigaliDateTime(locale, ticket.updatedAt)}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-ink/50" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
