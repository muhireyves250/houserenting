import { BedDouble, Bike, UtensilsCrossed } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Chip, FillScreen, ScrollArea, StatTiles, adminCard } from "@/features/admin/components/kit";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { ordersForHost } from "@/features/food/service";
import { roomLabel } from "@/features/rooms/links";
import { cn } from "@/lib/cn";
import { requireUser } from "@/lib/session";

/**
 * A place's owner: the food orders of guests staying at their places, read only. Orders sent to the place come
 * first, so whoever receives one can match its number and take it to the guest's room.
 */
export default async function HostOrdersPage() {
  const user = await requireUser("/host/orders");
  const [t, tRooms, locale, rows] = await Promise.all([getTranslations("Food"), getTranslations("Rooms"), getLocale(), ordersForHost(user.id)]);
  const orders = [...rows.filter((o) => o.status === "OUT_FOR_DELIVERY"), ...rows.filter((o) => o.status !== "OUT_FOR_DELIVERY")];
  const count = (status: string) => rows.filter((o) => o.status === status).length;

  // Like the staff food page: the counts on top, the orders scrolling below (read only for owners).
  return (
    <FillScreen>
      <StatTiles
        items={[
          { label: t("status.OUT_FOR_DELIVERY"), count: count("OUT_FOR_DELIVERY"), tone: "text-primary" },
          { label: t("status.DELIVERED"), count: count("DELIVERED"), tone: "text-emerald-700" },
          { label: t("hostOrders.all"), count: rows.length },
        ]}
      />
      <ScrollArea>
      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface py-14 text-center ring-1 ring-line">
          <UtensilsCrossed className="size-8 text-line-strong" aria-hidden="true" />
          <p className="text-[15px] font-semibold text-ink">{t("hostOrders.empty")}</p>
          <p className="max-w-sm text-[13px] text-muted">{t("hostOrders.readOnly")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {orders.map((o) => {
            const sent = o.status === "OUT_FOR_DELIVERY";
            const room = [o.stay.room?.name, o.stay.roomNumber ? roomLabel(o.stay.roomNumber, (number) => tRooms("roomNumber", { number })) : null].filter(Boolean).join(" · ");
            return (
              <li key={o.reference} className={cn(adminCard, "gap-0", sent && "ring-2 ring-primary/50")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/* The number written on the order that arrives. */}
                    <p className="font-mono text-[18px] leading-6 font-bold tracking-wide text-ink">{o.reference}</p>
                    <p className="text-[13px] text-muted">{formatKigaliDateTime(locale, o.createdAt)}</p>
                  </div>
                  <Chip tone={sent ? "bg-primary text-white" : o.status === "DELIVERED" ? "bg-emerald-50 text-emerald-800" : "bg-canvas text-ink"}>{t(`status.${o.status}`)}</Chip>
                </div>
                {sent && (
                  <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary/[0.07] px-3 py-2 text-[13px] font-semibold text-primary">
                    <Bike className="size-4" aria-hidden="true" />
                    {t("hostOrders.onTheWay")}
                    {o.sentAt && <span className="font-normal text-primary/80">· {t("hostOrders.sentAt", { time: formatKigaliDateTime(locale, o.sentAt) })}</span>}
                  </p>
                )}
                <dl className="mt-3 grid grid-cols-2 gap-3 text-[14px]">
                  <div>
                    <dt className="text-[12px] text-muted">{t("hostOrders.guest")}</dt>
                    <dd className="font-semibold text-ink">{o.stay.guest.name}</dd>
                    <dd className="text-[12px] text-muted">{o.stay.listing.title}</dd>
                  </div>
                  <div>
                    <dt className="text-[12px] text-muted">{t("hostOrders.room")}</dt>
                    <dd className="inline-flex items-center gap-1.5 font-semibold text-ink">
                      <BedDouble className="size-4 text-primary" aria-hidden="true" />
                      {room || "—"}
                    </dd>
                    <dd className="font-mono text-[12px] text-muted">{o.stay.reference}</dd>
                  </div>
                </dl>
                <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3 text-[13px] text-ink">
                  {o.items.map((i, n) => (
                    <li key={n} className="rounded-full bg-canvas px-2.5 py-1">
                      <b className="font-semibold tabular-nums">{i.quantity} ×</b> {i.name}
                    </li>
                  ))}
                </ul>
                {o.note && <p className="mt-2 text-[13px] text-muted">{t("yourNote", { note: o.note })}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {orders.length > 0 && <p className="mt-4 text-center text-[12px] text-muted">{t("hostOrders.readOnly")}</p>}
      </ScrollArea>
    </FillScreen>
  );
}
