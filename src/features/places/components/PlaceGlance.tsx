import { BedDouble, CheckCircle2, CircleAlert, DoorOpen, Hammer, Sparkles, UserRound } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { roomLabel } from "@/features/rooms/links";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import type { placeOverview } from "../overview";

type Overview = Awaited<ReturnType<typeof placeOverview>>;

/** Staff: a place at a glance — booked or free now, each room today (guest houses), and the work still open on it. */
export async function PlaceGlance({ overview }: { overview: Overview }) {
  const [t, tRooms, locale] = await Promise.all([getTranslations("Places.glance"), getTranslations("Rooms"), getLocale()]);
  const when = (d: Date) => formatKigaliDateTime(locale, d);
  const roomTone = { free: "bg-emerald-50 text-emerald-800 ring-emerald-200", occupied: "bg-primary/10 text-primary ring-primary/20", MAINTENANCE: "bg-red-50 text-red-800 ring-red-200", UNAVAILABLE: "bg-canvas text-muted ring-line", CLEANING: "bg-amber-50 text-amber-900 ring-amber-200", blocked: "bg-red-50 text-red-800 ring-red-200" } as const;
  const roomIcon = { free: DoorOpen, occupied: UserRound, MAINTENANCE: Hammer, UNAVAILABLE: CircleAlert, CLEANING: Sparkles, blocked: Hammer } as const;

  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Right now: booked or free, and what's next. */}
      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
        <h3 className="text-[15px] font-bold text-ink">{t("now")}</h3>
        {overview.rooms.length === 0 ? (
          overview.now ? (
            <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2.5 text-[14px] text-primary">
              <UserRound className="size-5 shrink-0" aria-hidden="true" />
              <span>{t("bookedNow", { guest: overview.now.guest.name, until: when(overview.now.endAt) })}</span>
            </p>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[14px] font-semibold text-emerald-800">
              <DoorOpen className="size-5 shrink-0" aria-hidden="true" />
              {t("freeNow")}
            </p>
          )
        ) : (
          <p className="text-[14px] text-ink">{t("roomsSummary", { free: overview.rooms.filter((r) => r.state === "free").length, all: overview.rooms.length, staying: overview.staying })}</p>
        )}
        <p className="text-[13px] text-muted">{overview.next ? t("next", { guest: overview.next.guest.name, when: when(overview.next.startAt), reference: overview.next.reference }) : t("noNext")}</p>

        {/* Each room today (guest houses). */}
        {overview.rooms.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {overview.rooms.map((r, i) => {
              const Icon = roomIcon[r.state];
              return (
                <li key={`${r.category}-${r.number ?? i}`} className={cn("flex items-start gap-2 rounded-xl px-3 py-2 text-[13px] ring-1", roomTone[r.state])}>
                  <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate font-semibold">
                      {r.category}
                      {r.number && ` · ${roomLabel(r.number, (n) => tRooms("roomNumber", { number: n }))}`}
                    </b>
                    <span className="block">{r.state === "occupied" ? t("roomBooked") : t(`room.${r.state}`)}</span>
                    {/* The stay under way (who, reference, in and out, paid), then the next booking. */}
                    {r.booking && <BookingLine b={r.booking} label={null} payLabel={t(`pay.${r.booking.pay}`)} inOut={t("inOut", { in: when(r.booking.startAt), out: when(r.booking.endAt) })} />}
                    {r.next && <BookingLine b={r.next} label={t("roomNext")} payLabel={t(`pay.${r.next.pay}`)} inOut={t("inOut", { in: when(r.next.startAt), out: when(r.next.endAt) })} />}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Work still open on this place, or all done. */}
      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
        <h3 className="text-[15px] font-bold text-ink">{t("work")}</h3>
        {overview.tasks.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[14px] font-semibold text-emerald-800">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
            {t("allDone")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {overview.tasks.map((task) => {
              const text = t(`task.${task.key as "claims"}`, { count: task.count });
              return (
                <li key={task.key} className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[14px] text-amber-950 ring-1 ring-amber-200">
                  <CircleAlert className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
                  {task.href.startsWith("/") ? (
                    <Link href={task.href} className="font-medium hover:underline">
                      {text}
                    </Link>
                  ) : (
                    <span className="font-medium">{text}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="flex items-center gap-1.5 text-[12px] text-muted">
          <BedDouble className="size-3.5" aria-hidden="true" />
          {t("hint")}
        </p>
      </div>
    </section>
  );
}

/** One booking on a room tile: guest and reference (opens it), check-in and check-out, and its payment. */
function BookingLine({ b, label, payLabel, inOut }: { b: import("../overview").RoomBooking; label: string | null; payLabel: string; inOut: string }) {
  const tone = b.pay === "paid" ? "bg-emerald-600 text-white" : b.pay === "waiting" ? "bg-amber-500 text-white" : "bg-red-600 text-white";
  return (
    <Link href={`/admin/bookings/${b.reference}`} className="mt-1.5 block rounded-lg bg-white/70 px-2 py-1.5 text-[12px] leading-[17px] text-ink ring-1 ring-black/5 hover:ring-primary/40">
      {label && <span className="block text-[11px] font-semibold text-muted uppercase">{label}</span>}
      <span className="flex items-center justify-between gap-2">
        <b className="truncate font-semibold">{b.guest}</b>
        <span className={cn("shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold", tone)}>{payLabel}</span>
      </span>
      <span className="block font-mono text-[11px] text-primary">{b.reference}</span>
      <span className="block text-muted">{inOut}</span>
    </Link>
  );
}
