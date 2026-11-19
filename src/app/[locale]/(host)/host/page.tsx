import { ArrowRight, BadgeCheck, BedDouble, CalendarClock, ChevronRight, Clock, House, KeyRound, Plus, UtensilsCrossed, Wallet } from "lucide-react";
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

const newButton =
  "inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-[#0a6fe0] px-5 py-2.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-[filter,transform] duration-300 hover:brightness-110 active:scale-[0.97]";
const card = "rounded-3xl bg-surface p-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line";

/**
 * The owner's dashboard: their own places only. How busy the places are, what they earn and when they're paid,
 * food on its way to their guests, and each place. Bookings, guests and payments are VIIPA's, so no guest details.
 */
export default async function HostPage() {
  const user = await requireUser("/host");
  const [t, tHost, tPlaces, listings, earnings, dash, payout, locale, helping] = await Promise.all([
    getTranslations("Host.dash"),
    getTranslations("Host"),
    getTranslations("Places"),
    hostListings(user.id),
    hostEarnings(user.id),
    hostDashboard(user.id),
    payoutAccountOf(user.id),
    getLocale(),
    db.placeMember.findMany({ where: { userId: user.id, role: "MANAGER", listing: { status: { not: "ARCHIVED" } } }, select: { role: true, listing: { select: { id: true, title: true, city: true } } } }),
  ]);
  const onTheWay = listings.length > 0 ? (await ordersForHost(user.id)).filter((o) => o.status === "OUT_FOR_DELIVERY").length : 0;
  const rwf = (n: number) => formatRWF(n, locale);
  const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const peak = Math.max(1, ...dash.months.map((m) => m.amount));
  const firstName = user.name.split(" ")[0] ?? user.name;

  const header = (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-[24px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[28px] md:leading-9">{t("hello", { name: firstName })}</h2>
          <p className="text-[15px] text-muted">{t("intro")}</p>
        </div>
        {listings.length > 0 && (
          <Link href="/host/listings/new" className={newButton}>
            <Plus className="size-4" aria-hidden="true" />
            {tHost("newListing")}
          </Link>
        )}
      </div>
    </>
  );

  if (listings.length === 0 && helping.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        {header}
        <EmptyState
          icon={<House />}
          title={tHost("emptyTitle")}
          body={tHost("emptyBody")}
          action={
            <Link href="/host/listings/new" className={newButton}>
              <Plus className="size-4" aria-hidden="true" />
              {tHost("newListing")}
            </Link>
          }
        />
      </div>
    );
  }

  const tiles = [
    { icon: House, label: t("tiles.live"), value: listings.filter((l) => l.status === "PUBLISHED").length },
    { icon: KeyRound, label: t("tiles.staying"), value: dash.stayingNow },
    { icon: CalendarClock, label: t("tiles.arriving"), value: dash.arriving },
    { icon: BedDouble, label: t("tiles.nights"), value: dash.nightsThisMonth },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {header}

      {/* At a glance */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(({ icon: Icon, label, value }) => (
          <div key={label} className={cn(card, "flex flex-col gap-2 p-4")}>
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Icon className="size-[18px]" aria-hidden="true" />
            </span>
            <span className="text-[26px] leading-8 font-bold tracking-[-0.02em] text-ink tabular-nums">{value}</span>
            <span className="text-[13px] leading-4 font-medium text-muted">{label}</span>
          </div>
        ))}
      </section>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Earnings with the last six months. */}
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-[17px] font-bold text-ink">{t("earningsTitle")}</h2>
              <p className="text-[13px] text-muted">{t("earningsNote")}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {(
              [
                ["due", earnings.due, "text-primary"],
                ["upcoming", earnings.upcoming, "text-ink"],
                ["paidOut", earnings.paidOut, "text-emerald-700"],
              ] as const
            ).map(([key, value, tone]) => (
              <div key={key} className="rounded-2xl bg-canvas px-3 py-2.5">
                <dt className="text-[11.5px] leading-4 font-medium text-muted">{t(key)}</dt>
                <dd className={cn("mt-1 text-[15px] font-bold tabular-nums md:text-[17px]", tone)}>{rwf(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 mb-2 text-[12px] font-semibold text-muted">{t("chartTitle")}</p>
          <ul className="flex h-36 items-end gap-2" aria-label={t("chartTitle")}>
            {dash.months.map((m) => (
              <li key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[10.5px] font-semibold text-ink/70 tabular-nums">{m.amount > 0 ? new Intl.NumberFormat(locale, { notation: "compact" }).format(m.amount) : ""}</span>
                <span
                  className={cn("w-full max-w-12 rounded-t-lg", m.amount > 0 ? "bg-gradient-to-t from-primary to-[#3d8cf0]" : "bg-canvas")}
                  style={{ height: `${Math.max(4, Math.round((m.amount / peak) * 100))}%` }}
                />
                <span className="text-[11px] text-muted">{month.format(new Date(`${m.month}-01T00:00:00Z`))}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-5">
          {/* All the owner's places. */}
          <Link href="/host/places" className={cn(card, "group flex items-center gap-3 p-4 transition-shadow hover:shadow-[0_14px_36px_-14px_rgba(0,64,160,0.45)]")}>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <House className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">{t("placesTitle")}</span>
              <span className="block text-[12.5px] text-muted">{t("placesCount", { count: listings.length })}</span>
            </span>
            <ChevronRight className="size-5 text-ink/40 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>

          {/* Where the money goes. */}
          <Link href="/host/payout" className={cn(card, "group flex items-center gap-3 p-4 transition-shadow hover:shadow-[0_14px_36px_-14px_rgba(0,64,160,0.45)]")}>
            <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", payout?.verifiedAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800")}>
              {payout?.verifiedAt ? <BadgeCheck className="size-5" aria-hidden="true" /> : payout ? <Clock className="size-5" aria-hidden="true" /> : <Wallet className="size-5" aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">{payout ? t("payoutSet") : t("payoutMissing")}</span>
              <span className="block text-[12.5px] text-muted">{payout ? (payout.verifiedAt ? t("payoutVerified") : t("payoutWaiting")) : t("payoutAction")}</span>
            </span>
            <ChevronRight className="size-5 text-ink/40 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>

          {/* Food on its way to the owner's guests. */}
          <Link href="/host/orders" className={cn(card, "group flex items-center gap-3 p-4 transition-shadow hover:shadow-[0_14px_36px_-14px_rgba(0,64,160,0.45)]")}>
            <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl", onTheWay > 0 ? "bg-primary text-white" : "bg-primary-soft text-primary")}>
              <UtensilsCrossed className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">{t("ordersTitle")}</span>
              <span className={cn("block text-[12.5px]", onTheWay > 0 ? "font-semibold text-primary" : "text-muted")}>{t("ordersOnWay", { count: onTheWay })}</span>
            </span>
            <ChevronRight className="size-5 text-ink/40 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>

          {earnings.payouts.length > 0 && (
            <section className={cn(card, "p-4")}>
              <h2 className="mb-2 text-[14px] font-semibold text-ink">{t("recentPayouts")}</h2>
              <ul className="flex flex-col divide-y divide-line text-[13px]">
                {earnings.payouts.slice(0, 4).map((p) => (
                  <li key={p.reference} className="flex items-center justify-between gap-2 py-2">
                    <span className="font-mono text-ink/80">{p.reference}</span>
                    <span className="font-semibold text-ink tabular-nums">{rwf(p.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="rounded-2xl bg-primary-soft/60 px-4 py-3 text-[12.5px] leading-5 text-ink/80">{t("vipaHandles")}</p>
        </div>
      </div>

      {/* Places this person helps run for someone else. */}
      {helping.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-[17px] font-bold text-ink">{tPlaces("helpingTitle")}</h2>
          <ul className="flex flex-col divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
            {helping.map((h) => (
              <li key={h.listing.id}>
                <Link href={`/host/listings/${h.listing.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-canvas/60">
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
    </div>
  );
}
