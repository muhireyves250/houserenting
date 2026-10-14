import { getLocale, getTranslations } from "next-intl/server";
import { CheckInOut } from "@/features/admin/components/StaffButtons";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { formatStayDates } from "@/features/bookings/format";
import { staffBookings } from "@/features/bookings/service";
import { todayISO } from "@/features/search/date-range";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";

const asISO = (d: Date) => d.toISOString().slice(0, 10);

export default async function AdminBookingsPage() {
  await requireAdmin("/admin/bookings");
  const [t, tBookings, locale, bookings] = await Promise.all([getTranslations("Admin"), getTranslations("Bookings"), getLocale(), staffBookings()]);
  const today = todayISO();
  return (
    <ul className="divide-y divide-line rounded-3xl bg-surface px-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
      {bookings.length === 0 && <li className="py-8 text-center text-[15px] text-muted">{t("nothingHere")}</li>}
      {bookings.map((b) => (
        <li key={b.reference} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge status={b.status} label={tBookings(`status.${b.status}`)} />
              <span className="font-mono text-xs text-muted">{b.reference}</span>
            </span>
            <Link href={`/admin/listings/${b.listing.id}`} className="block truncate text-[15px] font-semibold text-ink hover:underline">
              {b.listing.title}
            </Link>
            <span className="block text-[13px] text-muted">
              {b.guest.name} · {formatStayDates(locale, asISO(b.checkIn), asISO(b.checkOut))} · {formatRWF(b.total, locale)}
            </span>
          </span>
          {b.status === "CONFIRMED" && asISO(b.checkIn) <= today && <CheckInOut reference={b.reference} to="CHECKED_IN" />}
          {b.status === "CHECKED_IN" && <CheckInOut reference={b.reference} to="COMPLETED" />}
        </li>
      ))}
    </ul>
  );
}
