import { getLocale, getTranslations } from "next-intl/server";
import { ExportLink, PageIntro, Panel, Table, td } from "@/features/admin/components/ui";
import type { Money } from "@/features/reports/aggregate";
import { PrintButton } from "@/features/reports/components/PrintButton";
import { buildReport, readFilter, reportChoices } from "@/features/reports/service";
import { PLACE_TYPES } from "@/features/search/params";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";

type Props = { searchParams: Promise<Record<string, string | undefined>> };
const input = "rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink";

/** Money and activity reports by place, owner, category and date, with Excel export and print-to-PDF. */
export default async function AdminReportsPage({ searchParams }: Props) {
  await requireAdmin("/admin/reports");
  const q = await searchParams;
  const f = readFilter(q);
  const [t, tAdmin, tType, locale, data, [places, owners]] = await Promise.all([
    getTranslations("Reports"),
    getTranslations("Admin"),
    getTranslations("ListingType"),
    getLocale(),
    buildReport(f),
    reportChoices(),
  ]);
  const { report } = data;
  const rwf = (n: number) => formatRWF(n, locale);
  const weekday = (i: number) => new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 9, 18 + i)));
  const day = (d: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const exportQuery = new URLSearchParams(Object.entries({ from: f.from, to: f.to, by: f.by, place: f.listingId, owner: f.ownerId, type: f.type }).filter(([, v]) => v) as [string, string][]);
  const typeLabel = (key: string) => ((PLACE_TYPES as readonly string[]).includes(key) ? tType(key as (typeof PLACE_TYPES)[number]) : key);

  const moneyTable = (rows: (Money & { key: string; label: string })[], label: (r: { key: string; label: string }) => string) => (
    <Table
      head={[t("col.what"), t("col.bookings"), t("col.nights"), t("col.gross"), t("col.platform"), t("col.owners"), t("col.refunds")]}
      empty={rows.length === 0 ? <p className="py-6 text-center text-[14px] text-muted">{tAdmin("nothingHere")}</p> : null}
    >
      {rows.map((r) => (
        <tr key={r.key}>
          <td className={td}>{label(r)}</td>
          <td className={`${td} tabular-nums`}>{r.bookings}</td>
          <td className={`${td} tabular-nums`}>{r.nights}</td>
          <td className={`${td} tabular-nums`}>{rwf(r.gross)}</td>
          <td className={`${td} tabular-nums`}>{rwf(r.platform)}</td>
          <td className={`${td} tabular-nums`}>{rwf(r.hostPayout)}</td>
          <td className={`${td} tabular-nums`}>{rwf(r.refunds)}</td>
        </tr>
      ))}
    </Table>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageIntro
        description={t("intro")}
        actions={
          <>
            <ExportLink href={`/api/v1/admin/export/report?${exportQuery}`} label={t("excel")} />
            <PrintButton label={t("pdf")} />
          </>
        }
      />
      <form data-print-hide className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("from")}
          <input type="date" name="from" defaultValue={f.from} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("to")}
          <input type="date" name="to" defaultValue={f.to} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("view")}
          <select name="by" defaultValue={f.by} className={input}>
            {(["day", "week", "month", "year"] as const).map((g) => (
              <option key={g} value={g}>
                {t(`by.${g}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("category")}
          <select name="type" defaultValue={f.type ?? ""} className={input}>
            <option value="">{t("allCategories")}</option>
            {PLACE_TYPES.map((type) => (
              <option key={type} value={type}>
                {tType(type)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("place")}
          <select name="place" defaultValue={f.listingId ?? ""} className={`${input} max-w-[220px]`}>
            <option value="">{t("allPlaces")}</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("owner")}
          <select name="owner" defaultValue={f.ownerId ?? ""} className={`${input} max-w-[200px]`}>
            <option value="">{t("allOwners")}</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-full bg-primary px-5 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover">
          {t("show")}
        </button>
      </form>

      <p className="text-[13px] text-muted">{t("period", { from: day(f.from), to: day(f.to) })}</p>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: t("col.bookings"), value: String(report.totals.bookings) },
          { label: t("col.gross"), value: rwf(report.totals.gross) },
          { label: t("col.platform"), value: rwf(report.totals.platform) },
          { label: t("col.owners"), value: rwf(report.totals.hostPayout) },
          { label: t("col.nights"), value: String(report.totals.nights) },
          { label: t("commission"), value: rwf(report.totals.commission) },
          { label: t("guestFees"), value: rwf(report.totals.guestFees) },
          { label: t("col.refunds"), value: rwf(report.totals.refunds) },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface p-4">
            <span className="block text-[13px] text-muted">{tile.label}</span>
            <span className="block text-[20px] font-semibold text-ink tabular-nums">{tile.value}</span>
          </div>
        ))}
      </section>

      <Panel title={t("taxTitle")}>
        <div className="grid gap-3 sm:grid-cols-3">
          <p className="text-[14px] text-ink">
            {t("taxBase")} <b className="block text-[18px] tabular-nums">{rwf(report.tax.base)}</b>
          </p>
          <p className="text-[14px] text-ink">
            {data.rates.vatBps ? t("vatAt", { rate: data.rates.vatBps / 100 }) : t("vatNotSet")}
            <b className="block text-[18px] tabular-nums">{report.tax.vat === null ? "—" : rwf(report.tax.vat)}</b>
          </p>
          <p className="text-[14px] text-ink">
            {data.rates.citBps ? t("citAt", { rate: data.rates.citBps / 100 }) : t("citNotSet")}
            <b className="block text-[18px] tabular-nums">{report.tax.cit === null ? "—" : rwf(report.tax.cit)}</b>
          </p>
        </div>
        <p className="mt-3 text-xs text-muted">{t("taxNote")}</p>
      </Panel>

      <Panel title={t(`byPeriod.${f.by}`)} flush>
        {moneyTable(report.byPeriod, (r) => (f.by === "day" ? day(r.key) : f.by === "week" ? t("weekOf", { date: day(r.key) }) : r.key))}
      </Panel>
      <Panel title={t("byCategory")} flush>
        {moneyTable(report.byType, (r) => typeLabel(r.key))}
      </Panel>
      <Panel title={t("byPlace")} flush>
        {moneyTable(report.byPlace, (r) => r.label)}
      </Panel>
      <Panel title={t("byOwner")} flush>
        {moneyTable(report.byOwner, (r) => r.label)}
      </Panel>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-3">
        <Panel title={t("busiest")}>
          <ul className="flex flex-col gap-1 text-[14px]">
            {report.busiest.length === 0 ? <li className="text-muted">{tAdmin("nothingHere")}</li> : report.busiest.map((d) => <li key={d.day}>{t("dayCount", { date: day(d.day), count: d.count })}</li>)}
          </ul>
        </Panel>
        <Panel title={t("quietest")}>
          <ul className="flex flex-col gap-1 text-[14px]">
            {report.quietest.map((d) => (
              <li key={d.day}>{t("dayCount", { date: day(d.day), count: d.count })}</li>
            ))}
          </ul>
        </Panel>
        <Panel title={t("weekdays")}>
          <ul className="flex flex-col gap-1 text-[14px]">
            {[1, 2, 3, 4, 5, 6, 0].map((i) => {
              const w = report.weekdays[i]!;
              return (
                <li key={i} className="flex justify-between gap-2">
                  <span>{weekday(i)}</span>
                  <span className="tabular-nums">
                    {w.bookings} · {rwf(w.gross)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {data.orders.length > 0 && (
        <Panel title={t("ordersTitle")} flush>
          <Table head={[t("restaurant"), t("col.orders"), t("col.gross"), t("delivery")]}>
            {data.orders.map((o) => (
              <tr key={o.restaurant}>
                <td className={td}>{o.restaurant}</td>
                <td className={`${td} tabular-nums`}>{o.orders}</td>
                <td className={`${td} tabular-nums`}>{rwf(o.total)}</td>
                <td className={`${td} tabular-nums`}>{rwf(o.delivery)}</td>
              </tr>
            ))}
          </Table>
        </Panel>
      )}
    </div>
  );
}
