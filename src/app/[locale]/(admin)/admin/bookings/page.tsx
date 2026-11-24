import { getLocale, getTranslations } from "next-intl/server";
import { ActionsMenu } from "@/features/admin/components/ActionsMenu";
import { moveBookingAction } from "@/features/admin/moderation-actions";
import { markNoShowAction } from "@/features/stay/actions";
import { FillScreen, ScrollArea, Toolbar } from "@/features/admin/components/kit";
import { ExportLink, FilterTabs, Pagination, SearchBox } from "@/features/admin/components/ui";
import { roomLabel } from "@/features/rooms/links";
import { todayISO } from "@/features/search/date-range";
import { BOOKING_STATUSES, searchBookings, type BookingStatusFilter } from "@/features/admin/queries";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { formatStayDates } from "@/features/bookings/format";
import { GuestRequests } from "@/features/stay/components/GuestRequests";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { autoCheckOut } from "@/features/bookings/service";
import { requireStaff } from "@/lib/permissions";

type Props = { searchParams: Promise<{ status?: string; q?: string; page?: string }> };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function AdminBookingsPage({ searchParams }: Props) {
  await requireStaff("bookings", "/admin/bookings");
  const params = await searchParams;
  const status = BOOKING_STATUSES.includes(params.status as BookingStatusFilter) ? (params.status as BookingStatusFilter) : undefined;
  const q = (params.q ?? "").slice(0, 100);
  const page = Math.max(1, Number(params.page) || 1);
  const today = todayISO();
  // Stays whose time is up are checked out first.
  await autoCheckOut();
  const [t, tBookings, tListings, tRooms, locale, result, tType] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Bookings"),
    getTranslations("Listings"),
    getTranslations("Rooms"),
    getLocale(),
    searchBookings({ status, q, page }),
    getTranslations("ListingType"),
  ]);
  const query = (extra: Record<string, string | undefined>) =>
    Object.fromEntries(Object.entries({ status, q: q || undefined, ...extra }).filter(([, v]) => v)) as Record<string, string>;
  const all = Object.values(result.counts).reduce((a, b) => a + (b ?? 0), 0);
  const exportHref = `/api/v1/admin/export/bookings?${new URLSearchParams(query({}))}`;

  return (
    <FillScreen>
      {/* Search and filters with Export on one row; requests and bookings scroll below. */}
      <Toolbar actions={<ExportLink href={exportHref} label={t("exportCsv")} />}>
      <div className="flex flex-col gap-3">
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
      </Toolbar>
      <ScrollArea>
      {/* What guests asked to change, and refunds to send: answered first. */}
      <GuestRequests />
      {/* One card per booking, with the quick steps that apply now (the rest is on its page). */}
      {result.rows.length === 0 ? (
        <p className="rounded-2xl bg-surface py-12 text-center text-[14px] text-muted ring-1 ring-line">{t("nothingHere")}</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {result.rows.map((b) => {
            const started = iso(b.checkIn) <= today;
            return (
              <li key={b.reference} className="grid gap-x-5 gap-y-2 rounded-2xl bg-surface p-4 ring-1 ring-line md:grid-cols-[150px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                <div className="flex items-center justify-between gap-2 md:flex-col md:items-start">
                  <Link href={`/admin/bookings/${b.reference}`} className="font-mono text-[14px] font-bold text-primary hover:underline">
                    {b.reference}
                  </Link>
                  <StatusBadge status={b.status} label={tBookings(`status.${b.status}`)} />
                  {/* Paid, waiting for VIIPA to confirm the guest's payment, or not paid. */}
                  {(() => {
                    const pay = b.payments.some((p) => p.status === "SUCCEEDED") || ["CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(b.status) ? "paid" : b.payments.some((p) => p.status === "PENDING") ? "waiting" : "unpaid";
                    const tone = pay === "paid" ? "bg-emerald-50 text-emerald-800" : pay === "waiting" ? "bg-amber-100 text-amber-900" : "bg-red-50 text-red-800";
                    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{t(`pay.${pay}`)}</span>;
                  })()}
                </div>
                <div className="min-w-0 text-[14px]">
                  <span className="block truncate font-semibold text-ink">{b.listing.title}</span>
                  <span className="block truncate text-[12px] text-muted">{tType(b.listing.type)}</span>
                  {b.room && (
                    <span className="block truncate text-[12px] text-muted">
                      {[b.room.name, b.roomNumber && roomLabel(b.roomNumber, (number) => tRooms("roomNumber", { number }))].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
                <div className="min-w-0 text-[14px]">
                  <Link href={`/admin/users/${b.guest.id}`} className="block truncate text-ink hover:text-primary">
                    {b.guest.name}
                  </Link>
                  <span className="block truncate text-[12px] text-muted">
                    {formatStayDates(locale, iso(b.checkIn), iso(b.checkOut))} · {tListings(`unitCount.${b.unit}`, { count: b.quantity })}
                  </span>
                </div>
                <div className="text-[14px] tabular-nums">
                  <span className="block font-bold text-ink">{formatRWF(b.total, locale)}</span>
                  <span className="block text-[12px] text-muted">{t("ownerShort", { amount: formatRWF(b.hostPayout, locale) })}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  {/* One Actions button: open it, check in or out, mark a no-show. */}
                  <ActionsMenu
                    items={[
                      { kind: "link", label: t("openToAnswer"), href: `/admin/bookings/${b.reference}` },
                      ...(b.status === "CONFIRMED" && started ? [{ kind: "run" as const, label: t("checkIn"), action: moveBookingAction.bind(null, b.reference, "CHECKED_IN") }] : []),
                      ...(b.status === "CHECKED_IN" ? [{ kind: "run" as const, label: t("checkOut"), action: moveBookingAction.bind(null, b.reference, "COMPLETED") }] : []),
                      ...(b.status === "CONFIRMED" && iso(b.checkIn) < today ? [{ kind: "run" as const, label: t("noShow"), action: markNoShowAction.bind(null, b.reference), confirm: t("noShowQuestion"), danger: true }] : []),
                    ]}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination
        page={page}
        pages={result.pages}
        label={(p, n) => t("pageOf", { page: p, pages: n })}
        hrefFor={(p) => `/admin/bookings?${new URLSearchParams(query({ page: String(p) }))}`}
      />
      </ScrollArea>
    </FillScreen>
  );
}
