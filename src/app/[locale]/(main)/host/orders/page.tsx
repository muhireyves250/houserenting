import { BedDouble, Bike, UtensilsCrossed } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHero } from "@/components/shell/PageHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { ordersForHost } from "@/features/food/service";
import { roomLabel } from "@/features/rooms/links";
import { cn } from "@/lib/cn";
import { requireUser } from "@/lib/session";

const card = "rounded-3xl bg-surface p-4 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 md:p-5";

/**
 * A place's owner: the food orders of guests staying at their places, read only. Orders sent to the place come
 * first, so whoever receives one can match its number and take it to the guest's room.
 */
export default async function HostOrdersPage() {
  const user = await requireUser("/host/orders");
  const [t, tRooms, locale, rows] = await Promise.all([getTranslations("Food"), getTranslations("Rooms"), getLocale(), ordersForHost(user.id)]);
  const orders = [...rows.filter((o) => o.status === "OUT_FOR_DELIVERY"), ...rows.filter((o) => o.status !== "OUT_FOR_DELIVERY")];

  return (
    <PageContainer className="max-w-3xl py-6 max-md:pt-0 md:py-10">
      <PageHero title={t("hostOrders.title")} icon={UtensilsCrossed} />
      <h1 className="mb-2 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink max-md:hidden md:text-[32px] md:leading-10">{t("hostOrders.title")}</h1>
      <p className="mb-5 text-[14px] text-muted">{t("hostOrders.intro")}</p>
      {orders.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed />} title={t("hostOrders.empty")} body={t("hostOrders.readOnly")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((o) => {
            const sent = o.status === "OUT_FOR_DELIVERY";
            const room = [o.stay.room?.name, o.stay.roomNumber ? roomLabel(o.stay.roomNumber, (number) => tRooms("roomNumber", { number })) : null].filter(Boolean).join(" · ");
            return (
              <li key={o.reference} className={cn(card, sent ? "ring-2 ring-primary/50" : "ring-line")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/* The number written on the order that arrives. */}
                    <p className="font-mono text-[22px] leading-7 font-bold tracking-wide text-ink">{o.reference}</p>
                    <p className="text-[13px] text-muted">{formatKigaliDateTime(locale, o.createdAt)}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-3 py-1 text-[12px] font-bold", sent ? "bg-primary text-white" : o.status === "DELIVERED" ? "bg-emerald-50 text-emerald-800" : "bg-canvas text-ink")}>
                    {t(`status.${o.status}`)}
                  </span>
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
    </PageContainer>
  );
}
