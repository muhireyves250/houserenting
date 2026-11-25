import { CalendarDays, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatKigaliDateTime, formatStayDates } from "@/features/bookings/format";
import { StatusBadge } from "@/features/bookings/components/StatusBadge";
import { DeskButton } from "@/features/hosting/components/DeskButton";
import { requireWorkArea } from "@/features/hosting/work";
import { roomLabel } from "@/features/rooms/links";
import { todayISO } from "@/features/search/date-range";
import { UndoEarlyButton } from "@/features/stay/components/UndoEarlyButton";
import { db } from "@/lib/db";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The bookings of the places someone owns (or manages): guest, dates, room and status, with check-in and check-out
 * (and undoing an early check-out). No money here, and payments are confirmed by VIIPA, never here.
 */
export default async function HostBookingsPage() {
  const { user, work } = await requireWorkArea("bookings", "/host/bookings");
  const today = todayISO();
  const managed = work.places.filter((p) => p.role === "MANAGER").map((p) => p.listingId);
  const owned = await db.listing.findMany({ where: { hostId: user.id }, select: { id: true } });
  const listingIds = [...new Set([...owned.map((l) => l.id), ...managed])];
  const [t, tDesk, tBookings, tRooms, locale, rows] = await Promise.all([
    getTranslations("Host.bookings"),
    getTranslations("Host.desk"),
    getTranslations("Bookings"),
    getTranslations("Rooms"),
    getLocale(),
    db.booking.findMany({
      where: { listingId: { in: listingIds }, status: { in: ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN", "COMPLETED", "NO_SHOW", "CANCELLED"] }, checkOut: { gte: new Date(Date.parse(`${today}T00:00:00Z`) - 60 * 86_400_000) } },
      orderBy: [{ checkIn: "desc" }],
      take: 150,
      select: {
        reference: true,
        status: true,
        checkIn: true,
        checkOut: true,
        endAt: true,
        guests: true,
        roomNumber: true,
        checkedOutEarlyAt: true,
        earlyCheckoutReason: true,
        earlyCheckoutAppeal: true,
        room: { select: { name: true } },
        guest: { select: { name: true, phone: true } },
        listing: { select: { title: true } },
        requests: { where: { status: "PENDING" }, select: { kind: true, reason: true } },
      },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">{t("intro")}</p>
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface py-14 text-center ring-1 ring-line">
          <CalendarDays className="size-8 text-line-strong" aria-hidden="true" />
          <p className="text-[15px] font-semibold text-ink">{t("empty")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {rows.map((b) => {
            const out = iso(b.checkOut);
            const canIn = b.status === "CONFIRMED" && iso(b.checkIn) <= today;
            return (
              <li key={b.reference} className="flex min-w-0 flex-col gap-2 rounded-2xl bg-surface p-3.5 ring-1 ring-line">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[14px] font-bold text-ink">{b.reference}</span>
                  <StatusBadge status={b.status} label={tBookings(`status.${b.status}`)} />
                  <span className="ml-auto text-[12px] text-muted">{formatStayDates(locale, iso(b.checkIn), out)}</span>
                </div>
                <p className="truncate text-[13px] text-ink">
                  <b className="font-semibold">{b.guest.name}</b>
                  {b.guest.phone && (
                    <a href={`tel:${b.guest.phone}`} className="ml-1.5 inline-flex items-center gap-1 text-primary hover:underline">
                      <Phone className="size-3.5" aria-hidden="true" />
                      {b.guest.phone}
                    </a>
                  )}
                  <span className="text-muted"> · {t("guests", { count: b.guests })}</span>
                </p>
                <p className="truncate text-[13px] text-muted">
                  {b.listing.title}
                  {b.room && ` · ${b.room.name}`}
                  {b.roomNumber && ` · ${roomLabel(b.roomNumber, (number) => tRooms("roomNumber", { number }))}`}
                </p>
                {/* A request waiting (leaving early, cancelling), and an early check-out with its reason and appeal. */}
                {b.requests.map((r, i) => (
                  <p key={i} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-900">
                    {t(`request.${r.kind as "SHORTEN"}`)}: “{r.reason}”
                  </p>
                ))}
                {b.checkedOutEarlyAt && (
                  <p className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[12px] text-red-900">
                    {t("early", { when: formatKigaliDateTime(locale, b.checkedOutEarlyAt), reason: b.earlyCheckoutReason ?? "" })}
                    {b.earlyCheckoutAppeal && <span className="block font-semibold">{t("appeal", { text: b.earlyCheckoutAppeal })}</span>}
                  </p>
                )}
                <div className="flex flex-wrap items-start justify-end gap-2">
                  {canIn && <DeskButton reference={b.reference} to="CHECKED_IN" label={tDesk("checkIn")} failed={tDesk("failed")} />}
                  {b.status === "CHECKED_IN" && <DeskButton reference={b.reference} to="COMPLETED" label={tDesk("checkOut")} failed={tDesk("failed")} early={out > today ? { question: tDesk("earlyQuestion"), confirm: tDesk("earlyConfirm") } : undefined} />}
                  {b.status === "COMPLETED" && b.checkedOutEarlyAt && b.endAt > new Date(Date.parse(`${today}T00:00:00Z`)) && <UndoEarlyButton reference={b.reference} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
