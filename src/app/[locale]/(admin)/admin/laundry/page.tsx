import { getLocale, getTranslations } from "next-intl/server";
import { PageIntro, Panel } from "@/features/admin/components/ui";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { LaundryStaffActions } from "@/features/laundry/components/LaundryStaffActions";
import { laundryOwed, OPEN_LAUNDRY } from "@/features/laundry/rules";
import { placesLaundry, staffLaundry } from "@/features/laundry/service";
import { PlaceLaundrySetting } from "@/features/laundry/components/PlaceLaundrySetting";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";

/** Staff: every guest's laundry, open orders and unpaid ones first. */
export default async function AdminLaundryPage() {
  await requireAdmin("/admin/laundry");
  const [t, locale, rows, places] = await Promise.all([getTranslations("Laundry"), getLocale(), staffLaundry(), placesLaundry()]);
  const needsWork = (o: (typeof rows)[number]) => OPEN_LAUNDRY.includes(o.status) || laundryOwed(o);
  const orders = [...rows.filter(needsWork), ...rows.filter((o) => !needsWork(o))];

  return (
    <div className="flex flex-col gap-5">
      <PageIntro description={t("admin.intro")} />
      {/* Which places offer laundry: off, free, or a price per kg. */}
      <Panel title={t("admin.placesTitle")}>
        <p className="-mt-1 mb-3 text-[13px] text-muted">{t("placeHint")}</p>
        <ul className="flex flex-col divide-y divide-line">
          {places.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <span className="min-w-0 text-[14px]">
                <b className="block truncate font-semibold text-ink">{p.title}</b>
                <span className="text-[13px] text-muted">{p.city}</span>
              </span>
              <PlaceLaundrySetting listingId={p.id} initial={p.laundryPricePerKg} />
            </li>
          ))}
        </ul>
      </Panel>
      {orders.length === 0 ? (
        <p className="rounded-2xl bg-surface py-10 text-center text-[14px] text-muted ring-1 ring-line">{t("admin.empty")}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {orders.map((o) => {
            const kg = o.weightGrams !== null ? (o.weightGrams / 1000).toLocaleString(locale, { maximumFractionDigits: 2 }) : null;
            return (
              <li key={o.reference} className={cn("flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1", needsWork(o) ? "ring-primary/40" : "ring-line")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[13px] font-semibold text-ink">{o.reference}</p>
                    <p className="truncate text-[14px] font-semibold text-ink">
                      {o.listing.title}
                      {o.booking.room && ` · ${o.booking.room.name}`}
                    </p>
                    <p className="text-[13px] text-muted">
                      {o.booking.guest.name}
                      {o.booking.guest.phone && ` · ${o.booking.guest.phone}`} ·{" "}
                      <Link href={`/admin/bookings/${o.booking.reference}`} className="font-mono text-primary hover:underline">
                        {o.booking.reference}
                      </Link>
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-canvas px-2.5 py-0.5 text-[12px] font-semibold text-ink">{t(`status.${o.status}`)}</span>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-[13px]">
                  <div>
                    <dt className="text-muted">{t("admin.perKg", { price: formatRWF(o.pricePerKg, locale) })}</dt>
                    <dd className="text-ink">{o.pricePerKg === 0 ? t("admin.freeRate") : kg ? `${kg} kg` : "—"}</dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-muted">{formatKigaliDateTime(locale, o.createdAt)}</dt>
                    <dd className="font-semibold text-ink tabular-nums">
                      {o.amount !== null ? (o.amount > 0 ? formatRWF(o.amount, locale) : t("free")) : "—"}
                      {o.paidAt && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">{t("paid")}</span>}
                    </dd>
                  </div>
                </dl>
                {o.note && <p className="text-[13px] text-muted">{t("yourNote", { note: o.note })}</p>}
                {o.paymentClaim && !o.paidAt && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{t("admin.claimed", { reference: o.paymentClaim })}</p>}
                {o.status === "CANCELLED" && o.cancelReason && <p className="text-[13px] text-red-800">{t("cancelledBecause", { reason: o.cancelReason })}</p>}
                <LaundryStaffActions order={{ reference: o.reference, status: o.status, amount: o.amount, paidAt: o.paidAt, paymentClaim: o.paymentClaim }} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
