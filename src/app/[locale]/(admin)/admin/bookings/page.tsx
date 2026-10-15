import { getLocale, getTranslations } from "next-intl/server";
import { ExportLink, FilterTabs, PageIntro, Pagination, Panel, SearchBox, Table, td } from "@/features/admin/components/ui";
import { BOOKING_STATUSES, searchBookings, type BookingStatusFilter } from "@/features/admin/queries";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { formatKigaliDateTime, formatStayDates } from "@/features/bookings/format";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";

type Props = { searchParams: Promise<{ status?: string; q?: string; page?: string }> };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function AdminBookingsPage({ searchParams }: Props) {
  await requireAdmin("/admin/bookings");
  const params = await searchParams;
  const status = BOOKING_STATUSES.includes(params.status as BookingStatusFilter) ? (params.status as BookingStatusFilter) : undefined;
  const q = (params.q ?? "").slice(0, 100);
  const page = Math.max(1, Number(params.page) || 1);
  const [t, tBookings, tListings, locale, result] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Bookings"),
    getTranslations("Listings"),
    getLocale(),
    searchBookings({ status, q, page }),
  ]);
  const query = (extra: Record<string, string | undefined>) =>
    Object.fromEntries(Object.entries({ status, q: q || undefined, ...extra }).filter(([, v]) => v)) as Record<string, string>;
  const all = Object.values(result.counts).reduce((a, b) => a + (b ?? 0), 0);
  const exportHref = `/api/v1/admin/export/bookings?${new URLSearchParams(query({}))}`;

  return (
    <div>
      <PageIntro description={t("bookingsIntro")} actions={<ExportLink href={exportHref} label={t("exportCsv")} />} />
      <div className="mb-4 flex flex-col gap-3">
        <SearchBox value={q} placeholder={t("searchBookings")} keep={{ status }} />
        <FilterTabs
          items={[
            { label: t("all"), href: { pathname: "/admin/bookings", query: query({ status: undefined }) }, on: !status, count: all },
            ...BOOKING_STATUSES.map((s) => ({
              label: tBookings(`status.${s}`),
              href: { pathname: "/admin/bookings", query: query({ status: s }) },
              on: status === s,
              count: result.counts[s] ?? 0,
            })),
          ]}
        />
      </div>
      <Panel flush>
        <Table
          head={[t("col.reference"), t("col.place"), t("col.guest"), t("col.when"), t("col.total"), t("col.status")]}
          empty={result.rows.length === 0 ? <p className="py-12 text-center text-[14px] text-muted">{t("nothingHere")}</p> : null}
        >
          {result.rows.map((b) => (
            <tr key={b.reference} className="transition-colors hover:bg-canvas/70">
              <td className={td}>
                <Link href={`/admin/bookings/${b.reference}`} className="font-mono text-[13px] font-semibold text-primary hover:underline">
                  {b.reference}
                </Link>
                <span className="block text-xs text-muted">{formatKigaliDateTime(locale, b.createdAt)}</span>
              </td>
              <td className={td}>
                <span className="block max-w-[220px] truncate font-medium text-ink">{b.listing.title}</span>
                {b.room && <span className="block text-xs text-muted">{b.room.name}</span>}
              </td>
              <td className={td}>
                <Link href={`/admin/users/${b.guest.id}`} className="block max-w-[180px] truncate text-ink hover:text-primary">
                  {b.guest.name}
                </Link>
                <span className="block max-w-[180px] truncate text-xs text-muted">{b.guest.email}</span>
              </td>
              <td className={`${td} whitespace-nowrap`}>
                {formatStayDates(locale, iso(b.checkIn), iso(b.checkOut))}
                <span className="block text-xs text-muted">{tListings(`unitCount.${b.unit}`, { count: b.quantity })}</span>
              </td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>
                {formatRWF(b.total, locale)}
                <span className="block text-xs text-muted">{t("ownerShort", { amount: formatRWF(b.hostPayout, locale) })}</span>
              </td>
              <td className={td}>
                <StatusBadge status={b.status} label={tBookings(`status.${b.status}`)} />
              </td>
            </tr>
          ))}
        </Table>
        <Pagination
          page={page}
          pages={result.pages}
          label={(p, n) => t("pageOf", { page: p, pages: n })}
          hrefFor={(p) => `/admin/bookings?${new URLSearchParams(query({ page: String(p) }))}`}
        />
      </Panel>
    </div>
  );
}
