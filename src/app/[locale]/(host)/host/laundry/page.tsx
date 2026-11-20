import { BedDouble, Scale, Shirt, UserRound } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { adminCard, Chip, FillScreen, Group, ScrollArea, StatTiles, Toolbar } from "@/features/admin/components/kit";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { LaundryStaffActions } from "@/features/laundry/components/LaundryStaffActions";
import type { LaundryStatus } from "@/features/laundry/rules";
import { placeLaundry } from "@/features/laundry/service";
import { formatRWF } from "@/lib/format";
import { roomLabel } from "@/features/rooms/links";
import { requireUser } from "@/lib/session";

const TONE: Partial<Record<LaundryStatus, string>> = {
  ACCEPTED: "bg-amber-100 text-amber-900",
  PICKED_UP: "bg-primary/10 text-primary",
  WASHED: "bg-primary/10 text-primary",
  RETURNED: "bg-emerald-50 text-emerald-800",
  RECEIVED: "bg-emerald-100 text-emerald-800",
};

/**
 * The owner's laundry: guests' laundry VIIPA accepted at their places. They collect it from the room, wash and weigh
 * it (the weight sets the price), and bring it back; the guest then confirms they got it.
 */
export default async function HostLaundryPage() {
  const user = await requireUser("/host/laundry");
  const [t, tRooms, locale, rows] = await Promise.all([getTranslations("Laundry"), getTranslations("Rooms"), getLocale(), placeLaundry(user.id)]);
  const toCollect = rows.filter((o) => o.status === "ACCEPTED");
  const washing = rows.filter((o) => o.status === "PICKED_UP");
  const toReturn = rows.filter((o) => o.status === "WASHED");
  const withGuest = rows.filter((o) => o.status === "RETURNED");
  const done = rows.filter((o) => o.status === "RECEIVED").slice(0, 30);

  const card = (o: (typeof rows)[number]) => {
    const kg = o.weightGrams !== null ? (o.weightGrams / 1000).toLocaleString(locale, { maximumFractionDigits: 2 }) : null;
    const room = [o.booking.room?.name, o.booking.roomNumber && roomLabel(o.booking.roomNumber, (number) => tRooms("roomNumber", { number }))].filter(Boolean).join(" · ");
    return (
      <li key={o.reference} className={adminCard}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[16px] font-bold text-ink">{o.reference}</span>
          <Chip tone={TONE[o.status]}>{t(`status.${o.status}`)}</Chip>
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] text-ink">
          <span className="flex items-start gap-2">
            <BedDouble className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              <b className="font-semibold">{room || o.listing.title}</b>
              {room && ` · ${o.listing.title}`}
            </span>
          </span>
          <span className="flex items-start gap-2">
            <UserRound className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            {o.booking.guest.name}
          </span>
          <span className="flex items-start gap-2">
            <Scale className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {o.pricePerKg === 0 ? t("admin.freeRate") : t("admin.perKg", { price: formatRWF(o.pricePerKg, locale) })}
              {kg && ` · ${kg} kg`}
              {o.amount !== null && o.amount > 0 && ` · ${formatRWF(o.amount, locale)}`}
            </span>
          </span>
        </div>
        {o.note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{t("host.guestNote", { note: o.note })}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-[12px] text-muted">{formatKigaliDateTime(locale, o.updatedAt)}</span>
        </div>
        <LaundryStaffActions forPlace order={{ reference: o.reference, status: o.status, amount: o.amount, paidAt: o.paidAt, paymentClaim: o.paymentClaim }} />
      </li>
    );
  };
  const grid = (list: typeof rows) => <ul className="grid gap-3 lg:grid-cols-2">{list.map(card)}</ul>;
  const nothing = t("admin.groups.nothing");

  return (
    <FillScreen>
      <Toolbar>
        <StatTiles
          items={[
            { label: t("admin.groups.toCollect"), count: toCollect.length, href: "#to-collect", tone: "text-amber-700" },
            { label: t("admin.groups.washing"), count: washing.length, href: "#washing", tone: "text-primary" },
            { label: t("admin.groups.toReturn"), count: toReturn.length, href: "#to-return", tone: "text-primary" },
            { label: t("admin.groups.withGuest"), count: withGuest.length, href: "#with-guest", tone: "text-emerald-700" },
          ]}
        />
      </Toolbar>
      <ScrollArea className="flex flex-col gap-8">
        <p className="text-[13px] text-muted">{t("host.intro")}</p>
        {toCollect.length + washing.length + toReturn.length + withGuest.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface py-12 text-center ring-1 ring-line">
            <Shirt className="size-8 text-line-strong" aria-hidden="true" />
            <p className="text-[14px] text-muted">{t("host.empty")}</p>
          </div>
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
        {withGuest.length > 0 && (
          <Group id="with-guest" title={t("admin.groups.withGuest")} count={withGuest.length} empty={nothing}>
            {grid(withGuest)}
          </Group>
        )}
        {done.length > 0 && (
          <details className="rounded-2xl bg-surface px-4 ring-1 ring-line">
            <summary className="cursor-pointer py-3.5 text-[15px] font-semibold text-ink">
              {t("host.done")} <span className="text-muted tabular-nums">({done.length})</span>
            </summary>
            <div className="border-t border-line py-3">{grid(done)}</div>
          </details>
        )}
      </ScrollArea>
    </FillScreen>
  );
}
