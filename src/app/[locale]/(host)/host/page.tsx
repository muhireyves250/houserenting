import { ArrowRight, Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { ordersForHost } from "@/features/food/service";
import { hostDashboard, hostListings } from "@/features/hosting/service";
import { hostEarnings } from "@/features/ledger/service";
import { payoutAccountOf } from "@/features/places/payout-service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { House } from "lucide-react";

const panel = "rounded-2xl border border-line bg-surface";
const addButton = "inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover";

/**
 * The owner's overview, laid out like the staff one: a greeting, this month at a glance, earnings with the last six
 * months beside what needs the owner, then recent payouts. Own places only; no guest details (guests deal with VIIPA).
 */
export default async function HostPage() {
  const user = await requireUser("/host");
  const [t, tHost, tPlaces, listings, earnings, dash, payout, locale, helping, orders] = await Promise.all([
    getTranslations("Host.dash"),
    getTranslations("Host"),
    getTranslations("Places"),
    hostListings(user.id),
    hostEarnings(user.id),
    hostDashboard(user.id),
    payoutAccountOf(user.id),
    getLocale(),
    db.placeMember.findMany({ where: { userId: user.id, role: "MANAGER", listing: { status: { not: "ARCHIVED" } } }, select: { role: true, listing: { select: { id: true, title: true, city: true } } } }),
    ordersForHost(user.id),
  ]);
  const rwf = (n: number) => formatRWF(n, locale);
  const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const peak = Math.max(1, ...dash.months.map((m) => m.amount));
  const firstName = user.name.split(" ")[0] ?? user.name;

  const greeting = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[22px] leading-8 font-bold tracking-[-0.02em] text-ink">{t("hello", { name: firstName })}</p>
        <p className="text-[14px] text-muted">{t("intro")}</p>
      </div>
      <Link href="/host/listings/new" className={addButton}>
        <Plus className="size-4" aria-hidden="true" />
        {tHost("newListing")}
      </Link>
    </div>
  );

  if (listings.length === 0 && helping.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {greeting}
        <EmptyState icon={<House />} title={tHost("emptyTitle")} body={tHost("emptyBody")} />
      </div>
    );
  }

  const tiles = [
    { label: t("tiles.live"), value: listings.filter((l) => l.status === "PUBLISHED").length, href: "/host/places?status=PUBLISHED" },
    { label: t("tiles.staying"), value: dash.stayingNow, href: null },
    { label: t("tiles.arriving"), value: dash.arriving, href: null },
    { label: t("tiles.nights"), value: dash.nightsThisMonth, href: "/host/places" },
  ];
  // What needs the owner: only what's waiting (like the staff "Needs attention").
  const onTheWay = orders.filter((o) => o.status === "OUT_FOR_DELIVERY").length;
  const toFix = listings.filter((l) => l.status === "CHANGES_REQUESTED" || l.status === "REJECTED").length;
  const drafts = listings.filter((l) => l.status === "DRAFT").length;
  const attention = [
    { label: t("attention.payout"), count: payout ? 0 : 1, href: "/host/payout", show: !payout },
    { label: t("attention.payoutWaiting"), count: 1, href: "/host/payout", show: Boolean(payout && !payout.verifiedAt) },
    { label: t("attention.food"), count: onTheWay, href: "/host/orders", show: onTheWay > 0 },
    { label: t("attention.fix"), count: toFix, href: "/host/places?status=CHANGES_REQUESTED", show: toFix > 0 },
    { label: t("attention.drafts"), count: drafts, href: "/host/places?status=DRAFT", show: drafts > 0 },
    { label: t("attention.due"), count: earnings.due, href: "/host/payout", show: earnings.due > 0, money: true },
  ].filter((a) => a.show);

  return (
    <div className="flex flex-col gap-6">
      {greeting}

      {/* This month at a glance */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => {
          const body = (
            <>
              <span className="text-[12px] text-muted md:text-[13px]">{tile.label}</span>
              <span className="text-[20px] leading-7 font-semibold tracking-[-0.02em] text-ink tabular-nums md:text-[26px] md:leading-8">{tile.value}</span>
            </>
          );
          return tile.href ? (
            <Link key={tile.label} href={tile.href} className={cn(panel, "flex flex-col gap-1 p-3 md:gap-1.5 md:p-4")}>
              {body}
            </Link>
          ) : (
            <div key={tile.label} className={cn(panel, "flex flex-col gap-1 p-3 md:gap-1.5 md:p-4")}>
              {body}
            </div>
          );
        })}
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Earnings and the last six months. */}
        <section className={cn(panel, "p-4 md:p-5")}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-semibold text-ink">{t("earningsTitle")}</h2>
            <span className="text-[12px] text-muted">{t("earningsNote")}</span>
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                ["due", earnings.due, "text-primary"],
                ["upcoming", earnings.upcoming, "text-ink"],
                ["paidOut", earnings.paidOut, "text-emerald-700"],
              ] as const
            ).map(([key, value, tone]) => (
              <div key={key} className="rounded-xl bg-canvas px-3 py-2.5">
                <dt className="text-[11.5px] leading-4 text-muted">{t(key)}</dt>
                <dd className={cn("mt-1 text-[15px] font-semibold tabular-nums md:text-[17px]", tone)}>{rwf(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 mb-2 text-[12px] font-semibold text-muted">{t("chartTitle")}</p>
          <ul className="flex h-44 items-end gap-2 md:h-48" aria-label={t("chartTitle")}>
            {dash.months.map((m) => (
              <li key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[10.5px] font-semibold text-ink/70 tabular-nums">{m.amount > 0 ? compact.format(m.amount) : ""}</span>
                <span className={cn("w-full max-w-14 rounded-t-md", m.amount > 0 ? "bg-primary" : "bg-canvas")} style={{ height: `${Math.max(3, Math.round((m.amount / peak) * 100))}%` }} />
                <span className="text-[11px] text-muted">{month.format(new Date(`${m.month}-01T00:00:00Z`))}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Needs attention (phones: only when something waits). */}
        <section className={cn(panel, "flex flex-col p-5", attention.length === 0 && "max-md:hidden")}>
          <h2 className="mb-3 text-[15px] font-semibold text-ink">{t("needsAttention")}</h2>
          {attention.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-8 text-center text-[14px] text-muted">{t("allClear")}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2">
              {attention.map((a) => (
                <li key={a.label}>
                  <Link href={a.href} className="flex h-full flex-col gap-0.5 rounded-xl border border-line px-3 py-2.5 transition-colors hover:border-primary">
                    <span className={cn("leading-7 font-bold text-primary tabular-nums", a.money ? "text-[15px]" : "text-[22px]")}>{a.money ? rwf(a.count) : a.count}</span>
                    <span className="text-[12px] leading-4 font-semibold text-ink">{a.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {earnings.payouts.length > 0 && (
        <section className={cn(panel, "p-5")}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">{t("recentPayouts")}</h2>
            <Link href="/host/payout" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
              {t("tabs.payout")}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
          <ul className="divide-y divide-line text-[13px]">
            {earnings.payouts.slice(0, 5).map((p) => (
              <li key={p.reference} className="flex items-center justify-between gap-2 py-2.5">
                <span className="font-mono text-ink/80">{p.reference}</span>
                <span className="font-semibold text-ink tabular-nums">{rwf(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Places this person helps run for someone else. */}
      {helping.length > 0 && (
        <section className={cn(panel, "p-5")}>
          <h2 className="mb-2 text-[15px] font-semibold text-ink">{tPlaces("helpingTitle")}</h2>
          <ul className="divide-y divide-line">
            {helping.map((h) => (
              <li key={h.listing.id}>
                <Link href={`/host/listings/${h.listing.id}`} className="flex items-center justify-between gap-3 py-3 hover:text-primary">
                  <span>
                    <span className="block text-[14px] font-semibold text-ink">{h.listing.title}</span>
                    <span className="block text-xs text-muted">
                      {tPlaces(`teamRole.${h.role}`)} · {h.listing.city}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-ink/50" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[12.5px] text-muted">{t("vipaHandles")}</p>
    </div>
  );
}
