import { ConciergeBell, Phone, Sparkles } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatKigaliTime, formatStayDates } from "@/features/bookings/format";
import { DeskButton } from "@/features/hosting/components/DeskButton";
import { autoCheckOut } from "@/features/bookings/service";
import { cleaningToDo } from "@/features/stay/cleaning";
import { CleaningDoneButton } from "@/features/stay/components/CleaningDoneButton";
import { EbmUpload } from "@/features/invoices/components/EbmUpload";
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
  const { user, work } = await requireWorkArea("desk", "/host/desk");
  // Guests whose stay ended are checked out before the desk is shown.
  await autoCheckOut();
  // The places they work the desk at, and the ones they own.
  const owned = await db.listing.findMany({ where: { hostId: user.id, status: { not: "ARCHIVED" } }, select: { id: true } });
  const listingIds = [...new Set([...work.places.map((p) => p.listingId), ...owned.map((l) => l.id)])];
  const today = todayISO();
  const tomorrow = iso(new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000));
  const [t, tRooms, locale, rows, cleaning] = await Promise.all([
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
        ebm: { select: { createdAt: true } },
      },
    }),
    // Rooms guests asked to have cleaned, oldest first.
    cleaningToDo(listingIds),
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
      {/* Cleaning guests asked for: the room, who, their note and when; Done tells the guest. */}
      {cleaning.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            {t("cleaning.title")}
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[12px] text-amber-900 tabular-nums">{cleaning.length}</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {cleaning.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
                <span className="min-w-0 flex-1 text-[13px] leading-5">
                  <b className="block text-[15px] font-bold text-amber-950">
                    {c.booking.roomNumber ? roomLabel(c.booking.roomNumber, (number) => tRooms("roomNumber", { number })) : (c.booking.room?.name ?? c.booking.listing.title)}
                    {c.booking.roomNumber && c.booking.room && <span className="font-medium"> · {c.booking.room.name}</span>}
                  </b>
                  <span className="text-amber-900">
                    {c.booking.guest.name}
                    {c.booking.guest.phone && (
                      <>
                        {" · "}
                        <a href={`tel:${c.booking.guest.phone}`} className="underline">
                          {c.booking.guest.phone}
                        </a>
                      </>
                    )}
                    {" · "}
                    {t("cleaning.asked", { time: formatKigaliTime(locale, c.createdAt) })}
                  </span>
                  {c.note && <span className="block text-amber-950">“{c.note}”</span>}
                </span>
                <CleaningDoneButton id={c.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
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
                    {/* The booking's EBM receipt: upload (or replace) and download. */}
                    <div className="w-full">
                      <EbmUpload reference={b.reference} uploadedAt={b.ebm ? formatKigaliTime(locale, b.ebm.createdAt) : null} />
                    </div>
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
