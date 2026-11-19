import { ArrowDownRight, ArrowUpRight, Minus, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BookingsChart } from "@/features/admin/components/BookingsChart";
import { CheckInOut } from "@/features/admin/components/StaffButtons";
import { dashboardStats, frontDesk, type DeskBooking, type Kpi } from "@/features/admin/stats";
import { unreadChats } from "@/features/chats/service";
import { laundryToHandle } from "@/features/laundry/service";
import { roomLabel } from "@/features/rooms/links";
import { db } from "@/lib/db";
import { formatStayDates } from "@/features/bookings/format";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/permissions";
import { RenewalPopup } from "@/features/places/components/RenewalPopup";
import { contractsEnding } from "@/features/places/status-service";

const panel = "rounded-2xl border border-line bg-surface";

/** Signed change against last month; up is good for every figure here. */
function Delta({ kpi, label, fresh }: { kpi: Kpi; label: string; fresh: string }) {
  // Nothing last month: a percentage would be meaningless.
  if (kpi.previous === 0) return <span className="text-xs text-muted">{kpi.value > 0 ? fresh : label}</span>;
  const change = Math.round(((kpi.value - kpi.previous) / kpi.previous) * 100);
  const Icon = change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : Minus;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", change > 0 ? "text-emerald-700" : change < 0 ? "text-red-700" : "text-muted")}>
      <Icon className="size-3.5" aria-hidden="true" />
      {change > 0 ? "+" : ""}
      {change}% <span className="font-normal text-muted">{label}</span>
    </span>
  );
}

export default async function AdminDashboardPage() {
  const user = await requireAdmin("/admin");
  const [t, tRooms, locale, stats, ending, desk, laundry, chats, foodOrders] = await Promise.all([
    getTranslations("Admin.dashboard"),
    getTranslations("Rooms"),
    getLocale(),
    dashboardStats(),
    contractsEnding(),
    frontDesk(),
    laundryToHandle(),
    unreadChats(user),
    // Food orders waiting for staff: a payment to check, or one to send.
    db.foodOrder.count({ where: { OR: [{ status: "PLACED", paymentClaim: { not: null }, paidAt: null }, { status: { in: ["ACCEPTED", "PREPARING", "READY"] } }] } }),
  ]);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const vsLast = t("vsLastMonth");

  const tiles = [
    { label: t("kpi.bookings"), value: compact.format(stats.kpis.bookings.value), kpi: stats.kpis.bookings },
    { label: t("kpi.paid"), value: `RWF ${compact.format(stats.kpis.paid.value)}`, kpi: stats.kpis.paid },
    { label: t("kpi.platform"), value: `RWF ${compact.format(stats.kpis.platform.value)}`, kpi: stats.kpis.platform },
    { label: t("kpi.newUsers"), value: compact.format(stats.kpis.newUsers.value), kpi: stats.kpis.newUsers },
  ];
  const attention = [
    { label: t("attention.food"), count: foodOrders, href: "/admin/orders" },
    { label: t("attention.laundry"), count: laundry, href: "/admin/laundry" },
    { label: t("attention.messages"), count: chats, href: "/admin/messages?show=waiting" },
    { label: t("attention.listings"), count: stats.attention.listings, href: "/admin/listings?status=PENDING_REVIEW" },
    { label: t("attention.moderation"), count: stats.attention.moderation, href: "/admin/support?tab=reviews" },
    { label: t("attention.tickets"), count: stats.attention.tickets, href: "/admin/support" },
    { label: t("attention.payments"), count: stats.attention.payments, href: "/admin/money" },
    { label: t("attention.rewards"), count: stats.attention.rewards, href: "/admin/money" },
    { label: t("attention.requests"), count: stats.attention.requests + stats.attention.refunds, href: "/admin/bookings" },
    { label: t("attention.contracts"), count: ending.length, href: "/admin/listings?status=ending" },
  ];
  const waiting = attention.filter((a) => a.count > 0);

  return (
    <div className="admin-overview flex flex-col gap-6">
      <RenewalPopup
        places={ending.map((l) => ({ id: l.id, title: l.title, contractEnd: l.contractEnd!.toISOString(), owner: l.host.name }))}
      />
      <div>
        <p className="text-[22px] leading-8 font-bold tracking-[-0.02em] text-ink">{t("title")}</p>
        <p className="text-[14px] text-muted">{t("subtitle", { listings: stats.liveListings })}</p>
      </div>

      {/* This month at a glance */}
      <section aria-label={t("thisMonth")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className={cn(panel, "flex flex-col gap-1 p-3 md:gap-1.5 md:p-4")}>
            <span className="text-[12px] text-muted md:text-[13px]">{tile.label}</span>
            <span className="text-[20px] leading-7 font-semibold tracking-[-0.02em] text-ink md:text-[26px] md:leading-8">{tile.value}</span>
            <Delta kpi={tile.kpi} label={vsLast} fresh={t("newThisMonth")} />
          </div>
        ))}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* The chart on every screen (a little shorter on phones). */}
        <section className={cn(panel, "p-4 md:p-5")}>
          <BookingsChart days={stats.bookingsPerDay} barsClass="h-44 md:h-56" />
        </section>

        {/* Needs attention (phones: only when something waits — "All clear" would just take space). */}
        <section className={cn(panel, "flex flex-col p-5", waiting.length === 0 && "max-md:hidden")}>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">{t("needsAttention")}</h2>
          {waiting.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-8 text-center text-[14px] text-muted">{t("allClear")}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {waiting.map((a) => (
                <li key={a.label}>
                  <Link href={a.href} className="flex h-full flex-col gap-0.5 rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-primary">
                    <span className="text-[22px] leading-7 font-bold text-primary tabular-nums">{a.count}</span>
                    <span className="text-[12px] leading-4 font-semibold text-ink">{a.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* The front desk, below the rest: each group folded like "Finished (11)", opened with a tap. */}
      <section aria-label={t("desk.title")} className="flex flex-col gap-2.5">
        <h2 className="text-[15px] font-semibold text-ink">{t("desk.title")}</h2>
        {(
          [
            ["arriving", desk.arriving, "CHECKED_IN"],
            ["leaving", desk.leaving, "COMPLETED"],
            ["overdue", desk.overdue, "COMPLETED"],
          ] as const
        ).map(([key, list, to]) => (
          <details key={key} className="rounded-2xl bg-surface px-4 ring-1 ring-line">
            <summary className="cursor-pointer py-3.5 text-[15px] font-semibold text-ink">
              {t(`desk.${key}`)} <span className={cn("tabular-nums", key === "overdue" && list.length > 0 ? "text-red-700" : "text-muted")}>({list.length})</span>
            </summary>
            <div className="border-t border-line py-3">
              {list.length === 0 ? (
                <p className="py-2 text-center text-[13px] text-muted">{t("desk.none")}</p>
              ) : (
                <ul className="grid gap-2 lg:grid-cols-2">
                  {list.map((b) => (
                    <DeskRow key={b.reference} b={b} to={to} locale={locale} room={(n) => roomLabel(n, (number) => tRooms("roomNumber", { number }))} />
                  ))}
                </ul>
              )}
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}

/** One guest at the front desk: who, where, when, and the button for the next step. */
function DeskRow({ b, to, locale, room }: { b: DeskBooking; to: "CHECKED_IN" | "COMPLETED"; locale: string; room: (n: string) => string }) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return (
    <li className="flex flex-col gap-2 rounded-xl bg-canvas p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold text-ink">{b.guest.name}</span>
          {b.guest.phone && (
            <a href={`tel:${b.guest.phone}`} className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline">
              <Phone className="size-3" aria-hidden="true" />
              {b.guest.phone}
            </a>
          )}
        </span>
        <Link href={`/admin/bookings/${b.reference}`} className="shrink-0 font-mono text-[12px] font-semibold text-primary hover:underline">
          {b.reference}
        </Link>
      </div>
      <span className="truncate text-[12px] text-muted">
        {b.listing.title}
        {b.room && ` · ${[b.room.name, b.roomNumber && room(b.roomNumber)].filter(Boolean).join(" ")}`} · {formatStayDates(locale, iso(b.checkIn), iso(b.checkOut))}
      </span>
      <CheckInOut reference={b.reference} to={to} />
    </li>
  );
}
