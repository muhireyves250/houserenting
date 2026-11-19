import type { ReactNode } from "react";
import { ArrowRight, User } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Chip, FillScreen, ScrollArea, StatTiles, Toolbar, adminCard } from "@/features/admin/components/kit";
import { TicketStatusSelect } from "@/features/admin/components/StaffButtons";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { TicketStatusBadge } from "@/features/support/components/TicketStatusBadge";
import { staffTickets, type TicketStatus } from "@/features/support/service";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

/** Help requests from guests and owners, for the Support and reviews page. */
export async function SupportView({ raw, tabs }: { raw: string | undefined; tabs: ReactNode }) {
  const status = STATUSES.find((s) => s === raw) as TicketStatus | undefined;
  const [t, tAdmin, locale, tickets, counts] = await Promise.all([
    getTranslations("Support"),
    getTranslations("Admin"),
    getLocale(),
    staffTickets(status),
    db.supportTicket.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: TicketStatus) => counts.find((c) => c.status === s)?._count._all ?? 0;
  return (
    <FillScreen>
      {tabs}
      <Toolbar>
        <StatTiles
          items={STATUSES.map((s) => ({
            label: t(`status.${s}`),
            count: count(s),
            // "Open" also lists those in progress (everything still to handle).
            href: s === "OPEN" ? { pathname: "/admin/support" } : { pathname: "/admin/support", query: { status: s } },
            on: s === "OPEN" ? !status : status === s,
            tone: s === "OPEN" ? "text-amber-700" : s === "IN_PROGRESS" ? "text-primary" : "text-emerald-700",
          }))}
        />
      </Toolbar>
      <ScrollArea className="flex flex-col gap-5">
      {tickets.length === 0 ? (
        <p className="rounded-2xl bg-surface py-10 text-center text-[14px] text-muted ring-1 ring-line">{tAdmin("nothingHere")}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {tickets.map((ticket) => (
            <li key={ticket.reference} className={adminCard}>
              <div className="flex flex-wrap items-center gap-2">
                <TicketStatusBadge status={ticket.status} label={t(`status.${ticket.status}`)} />
                <Chip>{t(`categories.${ticket.category}`)}</Chip>
                <span className="ml-auto text-[12px] text-muted">{formatKigaliDateTime(locale, ticket.updatedAt)}</span>
              </div>
              <Link href={`/admin/support/${ticket.reference}`} className="text-[16px] font-bold text-ink hover:text-primary">
                {ticket.subject}
              </Link>
              <span className="flex items-center gap-2 text-[13px] text-muted">
                <User className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {ticket.user.name} · <span className="font-mono">{ticket.reference}</span>
              </span>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <TicketStatusSelect reference={ticket.reference} status={ticket.status} />
                <Link href={`/admin/support/${ticket.reference}`} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover">
                  {tAdmin("openToAnswer")}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      </ScrollArea>
    </FillScreen>
  );
}
