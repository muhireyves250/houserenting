import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleAlert, Minus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { BookingsChart } from "@/features/admin/components/BookingsChart";
import { dashboardStats, latestBookings, type Kpi } from "@/features/admin/stats";
import { recentAudit } from "@/features/audit/service";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { dynamicMessage } from "@/lib/dynamic-message";
import { formatRWF } from "@/lib/format";
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
  await requireAdmin("/admin");
  const [t, tAdmin, tBookings, tListings, locale, stats, bookings, activity, ending] = await Promise.all([
    getTranslations("Admin.dashboard"),
    getTranslations("Admin"),
    getTranslations("Bookings"),
    getTranslations("Listings"),
    getLocale(),
    dashboardStats(),
    latestBookings(6),
    recentAudit({ take: 8 }),
    contractsEnding(),
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
    { label: t("attention.listings"), count: stats.attention.listings, href: "/admin/listings?status=PENDING_REVIEW" },
    { label: t("attention.moderation"), count: stats.attention.moderation, href: "/admin/moderation" },
    { label: t("attention.tickets"), count: stats.attention.tickets, href: "/admin/support" },
    { label: t("attention.payments"), count: stats.attention.payments, href: "/admin/money" },
    { label: t("attention.rewards"), count: stats.attention.rewards, href: "/admin/money" },
    { label: t("attention.requests"), count: stats.attention.requests + stats.attention.refunds, href: "/admin/requests" },
    { label: t("attention.contracts"), count: ending.length, href: "/admin/listings?status=ending" },
  ];
  const waiting = attention.filter((a) => a.count > 0);

  return (
    <div className="flex flex-col gap-6">
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
          <div key={tile.label} className={cn(panel, "flex flex-col gap-1.5 p-4")}>
            <span className="text-[13px] text-muted">{tile.label}</span>
            <span className="text-[26px] leading-8 font-semibold tracking-[-0.02em] text-ink">{tile.value}</span>
            <Delta kpi={tile.kpi} label={vsLast} fresh={t("newThisMonth")} />
          </div>
        ))}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className={cn(panel, "p-5")}>
          <BookingsChart days={stats.bookingsPerDay} />
        </section>

        {/* Needs attention */}
        <section className={cn(panel, "flex flex-col p-5")}>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">{t("needsAttention")}</h2>
          {waiting.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-8 text-center text-[14px] text-muted">{t("allClear")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {waiting.map((a) => (
                <li key={a.label}>
                  <Link href={a.href} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-primary">
                    <CircleAlert className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
                    <span className="flex-1 text-[14px] text-ink">{a.label}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary tabular-nums">{a.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        {/* Latest bookings */}
        <section className={panel}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-[15px] font-semibold text-ink">{t("latestBookings")}</h2>
            <Link href="/admin/bookings" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
              {t("seeAll")}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          {bookings.length === 0 ? (
            <p className="px-5 pb-6 text-[14px] text-muted">{tAdmin("nothingHere")}</p>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {bookings.map((b) => (
                <li key={b.reference} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">{b.listing.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {b.guest.name} · {tListings(`unitCount.${b.unit}`, { count: b.quantity })} · {formatKigaliDateTime(locale, b.createdAt)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[13px] font-semibold text-ink tabular-nums">{formatRWF(b.total, locale)}</span>
                    <StatusBadge status={b.status} label={tBookings(`status.${b.status}`)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recent activity */}
        <section className={panel}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="text-[15px] font-semibold text-ink">{t("activity")}</h2>
            <Link href="/admin/audit" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
              {t("seeAll")}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          {activity.length === 0 ? (
            <p className="px-5 pb-6 text-[14px] text-muted">{tAdmin("noAudit")}</p>
          ) : (
            <ol className="divide-y divide-line border-t border-line">
              {activity.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <span className="min-w-0 text-[14px] text-ink">
                    <b className="font-semibold">{dynamicMessage(tAdmin, `action.${entry.action}`, entry.action)}</b>
                    <span className="block truncate text-xs text-muted">{entry.actor?.name ?? tAdmin("system")}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatKigaliDateTime(locale, entry.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
