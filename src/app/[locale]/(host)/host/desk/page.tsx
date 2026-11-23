import { ConciergeBell, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatStayDates } from "@/features/bookings/format";
import { DeskButton } from "@/features/hosting/components/DeskButton";
import { autoCheckOut } from "@/features/bookings/service";
import { requireWorkArea } from "@/features/hosting/work";
import { todayISO } from "@/features/search/date-range";
import { roomLabel } from "@/features/rooms/links";
import { db } from "@/lib/db";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The front desk of the places someone works at (property manager or receptionist): who arrives today and tomorrow,
 * who is in, who leaves today. Check guests in once they've arrived and shown their ID, and out when they leave.
 */
export default async function FrontDeskPage() {
  const { work } = await requireWorkArea("desk", "/host/desk");
  // Guests whose stay ended are checked out before the desk is shown.
  await autoCheckOut();
  const listingIds = work.places.map((p) => p.listingId);
  const today = todayISO();
  const tomorrow = iso(new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000));
  const [t, tRooms, locale, rows] = await Promise.all([
    getTranslations("Host.desk"),
    getTranslations("Rooms"),
    getLocale(),
    db.booking.findMany({
      where: {
        listingId: { in: listingIds },
        OR: [
          { status: "CONFIRMED", checkIn: { lte: new Date(`${tomorrow}T00:00:00Z`) }, checkOut: { gte: new Date(`${today}T00:00:00Z`) } },
          { status: "CHECKED_IN" },
        ],
      },
      orderBy: [{ checkIn: "asc" }],
      take: 200,
      select: {
        reference: true,
        status: true,
        checkIn: true,
        checkOut: true,
        guests: true,
        roomNumber: true,
        room: { select: { name: true } },
        guest: { select: { name: true, phone: true } },
        listing: { select: { title: true } },
      },
    }),
  ]);
  const stays = rows.map((b) => ({ ...b, in: iso(b.checkIn), out: iso(b.checkOut) }));
  const groups = [
    { key: "arriving", items: stays.filter((b) => b.status === "CONFIRMED") },
    { key: "leaving", items: stays.filter((b) => b.status === "CHECKED_IN" && b.out <= today) },
    { key: "inHouse", items: stays.filter((b) => b.status === "CHECKED_IN" && b.out > today) },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {work.places.map((p) => (
          <span key={p.listingId} className="rounded-full bg-surface px-3 py-1 text-[12px] font-semibold text-ink ring-1 ring-line">
            {p.title} · {t(`role.${p.role}`)}
          </span>
        ))}
      </div>
      {groups.map(({ key, items }) => (
        <section key={key} className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
            {t(`group.${key}`)}
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[12px] text-primary tabular-nums">{items.length}</span>
          </h2>
          {items.length === 0 ? (
            <p className="rounded-2xl bg-surface px-4 py-5 text-center text-[13px] text-muted ring-1 ring-line">{t(`empty.${key}`)}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((b) => {
                const room = [b.room?.name, b.roomNumber && roomLabel(b.roomNumber, (number) => tRooms("roomNumber", { number }))].filter(Boolean).join(" · ");
                const canIn = b.status === "CONFIRMED" && b.in <= today;
                return (
                  <li key={b.reference} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{b.guest.name}</span>
                      <span className="block truncate text-[12px] text-muted">
                        <span className="font-mono">{b.reference}</span> · {b.listing.title}
                        {room ? ` · ${room}` : ""} · {t("guests", { count: b.guests })}
                      </span>
                      <span className="block text-[12px] text-muted">{formatStayDates(locale, b.in, b.out)}</span>
                    </span>
                    {b.guest.phone && (
                      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ink select-all">
                        <Phone className="size-3.5 text-muted" aria-hidden="true" />
                        {b.guest.phone}
                      </span>
                    )}
                    {canIn && <DeskButton reference={b.reference} to="CHECKED_IN" label={t("checkIn")} failed={t("failed")} />}
                    {b.status === "CONFIRMED" && !canIn && <span className="text-[12px] font-semibold text-muted">{t("tomorrow")}</span>}
                    {b.status === "CHECKED_IN" && <DeskButton reference={b.reference} to="COMPLETED" label={t("checkOut")} failed={t("failed")} />}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
      <p className="flex items-center gap-2 text-[12px] text-muted">
        <ConciergeBell className="size-4" aria-hidden="true" />
        {t("idNote")}
      </p>
    </div>
  );
}
