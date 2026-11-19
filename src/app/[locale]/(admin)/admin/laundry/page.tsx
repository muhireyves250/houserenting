import { BedDouble, Phone, Scale } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { adminCard, Chip, Group, StatTiles } from "@/features/admin/components/kit";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { LaundryStaffActions } from "@/features/laundry/components/LaundryStaffActions";
import { PlaceLaundrySetting } from "@/features/laundry/components/PlaceLaundrySetting";
import { laundryOwed, type LaundryStatus } from "@/features/laundry/rules";
import { placesLaundry, staffLaundry } from "@/features/laundry/service";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";

const TONE: Record<LaundryStatus, string> = {
  REQUESTED: "bg-amber-100 text-amber-900",
  PICKED_UP: "bg-primary/10 text-primary",
  WASHED: "bg-primary/10 text-primary",
  RETURNED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-50 text-red-700",
};

/**
 * Staff run guests' laundry in steps: to collect → washing (weigh it) → to return → paid. Finished ones and each
 * place's laundry price are folded away.
 */
export default async function AdminLaundryPage() {
  await requireAdmin("/admin/laundry");
  const [t, locale, rows, places] = await Promise.all([getTranslations("Laundry"), getLocale(), staffLaundry(), placesLaundry()]);
  const toCollect = rows.filter((o) => o.status === "REQUESTED");
  const washing = rows.filter((o) => o.status === "PICKED_UP");
  const toReturn = rows.filter((o) => o.status === "WASHED");
  const toPay = rows.filter((o) => o.status === "RETURNED" && laundryOwed(o));
  const done = rows.filter((o) => o.status === "CANCELLED" || (o.status === "RETURNED" && !laundryOwed(o))).slice(0, 40);
  const offering = places.filter((p) => p.laundryPricePerKg !== null).length;

  const card = (o: (typeof rows)[number]) => {
    const kg = o.weightGrams !== null ? (o.weightGrams / 1000).toLocaleString(locale, { maximumFractionDigits: 2 }) : null;
    return (
      <li key={o.reference} className={adminCard}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[16px] font-bold text-ink">{o.reference}</span>
          <Chip tone={TONE[o.status]}>{t(`status.${o.status}`)}</Chip>
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] text-ink">
          <span className="flex items-start gap-2">
            <Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <b className="font-semibold">{o.booking.guest.name}</b>
              {o.booking.guest.phone && (
                <>
                  {" · "}
                  <a href={`tel:${o.booking.guest.phone}`} className="text-primary hover:underline">
                    {o.booking.guest.phone}
                  </a>
                </>
              )}
            </span>
          </span>
          <span className="flex items-start gap-2">
            <BedDouble className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {o.listing.title}
              {o.booking.room && ` · ${o.booking.room.name}`} ·{" "}
              <Link href={`/admin/bookings/${o.booking.reference}`} className="font-mono text-primary hover:underline">
                {o.booking.reference}
              </Link>
            </span>
          </span>
          <span className="flex items-start gap-2">
            <Scale className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {o.pricePerKg === 0 ? t("admin.freeRate") : t("admin.perKg", { price: formatRWF(o.pricePerKg, locale) })}
              {kg && ` · ${kg} kg`}
            </span>
          </span>
        </div>
        {o.note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{t("yourNote", { note: o.note })}</p>}
        {o.paymentClaim && !o.paidAt && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-900">{t("admin.claimed", { reference: o.paymentClaim })}</p>}
        {o.status === "CANCELLED" && o.cancelReason && <p className="text-[13px] text-red-800">{t("cancelledBecause", { reason: o.cancelReason })}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-[12px] text-muted">{formatKigaliDateTime(locale, o.createdAt)}</span>
          <span className="flex items-center gap-2 text-[16px] font-bold text-ink tabular-nums">
            {o.amount !== null ? (o.amount > 0 ? formatRWF(o.amount, locale) : t("free")) : "—"}
            {o.paidAt && <Chip tone="bg-emerald-100 text-emerald-800">{t("paid")}</Chip>}
          </span>
        </div>
        <LaundryStaffActions order={{ reference: o.reference, status: o.status, amount: o.amount, paidAt: o.paidAt, paymentClaim: o.paymentClaim }} />
      </li>
    );
  };
  const grid = (list: typeof rows) => <ul className="grid gap-3 lg:grid-cols-2">{list.map(card)}</ul>;
  const nothing = t("admin.groups.nothing");

  return (
    <div className="flex flex-col gap-8">
      <StatTiles
        items={[
          { label: t("admin.groups.toCollect"), count: toCollect.length, href: "#to-collect", tone: "text-amber-700" },
          { label: t("admin.groups.washing"), count: washing.length, href: "#washing", tone: "text-primary" },
          { label: t("admin.groups.toReturn"), count: toReturn.length, href: "#to-return", tone: "text-primary" },
          { label: t("admin.groups.toPay"), count: toPay.length, href: "#to-pay", tone: "text-emerald-700" },
        ]}
      />
      {/* Only the steps that have laundry in them. */}
      {toCollect.length + washing.length + toReturn.length + toPay.length === 0 && (
        <p className="rounded-2xl bg-surface py-8 text-center text-[14px] text-muted ring-1 ring-line">{t("admin.groups.allClear")}</p>
      )}
      {toCollect.length > 0 && (
        <Group id="to-collect" title={t("admin.groups.toCollect")} count={toCollect.length} empty={nothing}>
          {grid(toCollect)}
        </Group>
      )}
      {washing.length > 0 && (
        <Group id="washing" title={t("admin.groups.washing")} count={washing.length} empty={nothing}>
          {grid(washing)}
        </Group>
      )}
      {toReturn.length > 0 && (
        <Group id="to-return" title={t("admin.groups.toReturn")} count={toReturn.length} empty={nothing}>
          {grid(toReturn)}
        </Group>
      )}
      {toPay.length > 0 && (
        <Group id="to-pay" title={t("admin.groups.toPay")} count={toPay.length} empty={nothing}>
          {grid(toPay)}
        </Group>
      )}

      {done.length > 0 && (
        <details className="rounded-2xl bg-surface px-4 ring-1 ring-line">
          <summary className="cursor-pointer py-3.5 text-[15px] font-semibold text-ink">
            {t("admin.groups.done")} <span className="text-muted tabular-nums">({done.length})</span>
          </summary>
          <ul className="flex flex-col divide-y divide-line border-t border-line pb-2">
            {done.map((o) => (
              <li key={o.reference} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2.5 text-[13px]">
                <span className="font-mono font-semibold text-ink">{o.reference}</span>
                <span className="min-w-0 flex-1 truncate text-muted">
                  {o.booking.guest.name} · {o.listing.title}
                </span>
                <span className="text-muted">{formatKigaliDateTime(locale, o.createdAt)}</span>
                <Chip tone={TONE[o.status]}>{t(`status.${o.status}`)}</Chip>
                <span className="w-20 text-right font-semibold text-ink tabular-nums">{o.amount ? formatRWF(o.amount, locale) : t("free")}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Which places offer laundry: off, free, or a price per kg. */}
      <details className="rounded-2xl bg-surface px-4 ring-1 ring-line">
        <summary className="cursor-pointer py-3.5 text-[15px] font-semibold text-ink">
          {t("admin.placesTitle")} <span className="text-[13px] font-normal text-muted">· {t("admin.groups.offering", { count: offering })}</span>
        </summary>
        <ul className="flex flex-col divide-y divide-line border-t border-line">
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
      </details>
    </div>
  );
}
