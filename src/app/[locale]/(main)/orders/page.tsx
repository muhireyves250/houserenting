import { Bike, BedDouble, ChevronRight, Clock, ShoppingBag, Store, UtensilsCrossed } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { AutoRefresh } from "@/features/food/components/AutoRefresh";
import { OrderAgain } from "@/features/food/components/OrderAgain";
import { ACTIVE_ORDER, type Fulfilment, type OrderStatus } from "@/features/food/rules";
import { myOrders, restaurantsNear } from "@/features/food/service";
import { todayISO } from "@/features/search/date-range";
import { myStay } from "@/features/stay/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { requireUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("Food");
  return { title: t("ordersTitle") };
}

const card = "rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line";

/** How far along an order is, as a share of its steps (deliveries have one more: on the way). */
function progress(status: OrderStatus, fulfilment: Fulfilment): number {
  const steps: OrderStatus[] = ["PLACED", "ACCEPTED", "PREPARING", "READY", ...(fulfilment === "DELIVERY" ? (["OUT_FOR_DELIVERY"] as const) : []), "DELIVERED"];
  return Math.max(0.08, steps.indexOf(status) / (steps.length - 1));
}

function Thumb({ photo, className }: { photo: string | null; className?: string }) {
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary", className)}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- restaurant photo
        <img src={photo} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <UtensilsCrossed className="size-6" aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * ORDERS: orders on their way first (status in words, arrival time, progress, Track), restaurants to order from next,
 * then past orders as compact rows with Order again.
 */
export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const [t, locale, orders, stayNow] = await Promise.all([getTranslations("Food"), getLocale(), myOrders(user.id), myStay(user.id)]);
  const stay = stayNow.current;
  const nearby = (await restaurantsNear(stay ? { lat: stay.listing.lat, lng: stay.listing.lng } : null, stay?.listing.id ?? null)).slice(0, 8);
  const current = orders.filter((o) => ACTIVE_ORDER.includes(o.status));
  const past = orders.filter((o) => !ACTIVE_ORDER.includes(o.status));

  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });
  const kigaliDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(d);
  const today = todayISO();
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  // "Today 20:36", "Yesterday 20:36", or "Fri 16 Oct".
  const when = (d: Date) =>
    kigaliDay(d) === today
      ? t("todayAt", { time: time.format(d) })
      : kigaliDay(d) === yesterday
        ? t("yesterdayAt", { time: time.format(d) })
        : new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Kigali" }).format(d);
  const items = (o: (typeof orders)[number]) => o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ");

  return (
    <PageContainer className="max-w-2xl pt-5 pb-10 md:py-10">
      <AutoRefresh active={current.length > 0} seconds={20} />
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("ordersTitle")}</h1>
        <Link href="/restaurants" className="rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-ink hover:border-primary">
          {t("browseRestaurants")}
        </Link>
      </div>

      <div className="flex flex-col gap-7">
        {/* On their way */}
        {current.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-[17px] font-bold text-ink">{t("inProgress")}</h2>
            {current.map((o) => {
              const eta = new Date(o.createdAt.getTime() + (o.restaurant.prepMinutes + (o.fulfilment === "DELIVERY" ? 20 : 0)) * 60_000);
              const Icon = o.fulfilment === "DELIVERY" ? Bike : o.fulfilment === "TO_STAY" ? BedDouble : Store;
              return (
                <article key={o.id} className={cn(card, "overflow-hidden ring-primary/30")}>
                  <div className="flex items-center gap-3 p-4">
                    <Thumb photo={o.restaurant.photoUrl} className="size-14" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-muted">{o.restaurant.name}</p>
                      <p className="text-[16px] leading-5 font-bold text-ink">{t(`statusTitle.${o.status}`)}</p>
                      <p className="mt-0.5 inline-flex items-center gap-1.5 text-[13px] text-ink">
                        <Clock className="size-3.5 text-primary" aria-hidden="true" />
                        {o.fulfilment === "PICKUP" ? t("readyAround", { time: time.format(eta) }) : t("arrivesAround", { time: time.format(eta) })}
                      </p>
                    </div>
                  </div>
                  <div className="mx-4 h-1.5 overflow-hidden rounded-full bg-primary/15" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary motion-safe:transition-[width]" style={{ width: `${Math.round(progress(o.status, o.fulfilment) * 100)}%` }} />
                  </div>
                  <div className="flex items-center gap-3 p-4">
                    <p className="min-w-0 flex-1 text-[13px] text-muted">
                      <span className="inline-flex items-center gap-1 font-semibold text-ink">
                        <Icon className="size-3.5" aria-hidden="true" />
                        {t(`fulfilment.${o.fulfilment}`)}
                      </span>
                      <span className="block truncate">{items(o)}</span>
                    </p>
                    <Link href={`/orders/${o.reference}`} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-hover">
                      {t("trackOrder")}
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* Where to order next */}
        {nearby.length > 0 && (
          <section>
            <h2 className="mb-3 text-[17px] font-bold text-ink">{stay ? t("orderNearStay") : t("orderFrom")}</h2>
            <ul className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
              {nearby.map((r) => (
                <li key={r.id} className="w-36 shrink-0 snap-start">
                  <Link href={`/restaurants/${r.id}`} className="block">
                    <Thumb photo={r.photoUrl} className="aspect-[4/3] w-full" />
                    <span className="mt-1.5 block truncate text-[14px] font-semibold text-ink">{r.name}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {r.paused ? t("closedNow") : r.atYourStay ? t("atYourStay") : t("aboutMinutes", { minutes: r.prepMinutes })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Past orders */}
        {past.length > 0 && (
          <section>
            <h2 className="mb-3 text-[17px] font-bold text-ink">{t("pastOrdersCustomer")}</h2>
            <ul className={cn(card, "divide-y divide-line")}>
              {past.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                  <Link href={`/orders/${o.reference}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Thumb photo={o.restaurant.photoUrl} className="size-12" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{o.restaurant.name}</span>
                      <span className="block truncate text-[13px] text-muted">{items(o)}</span>
                      <span className="block truncate text-[12px] text-muted">
                        <span className={cn("font-semibold", o.status === "DELIVERED" ? "text-emerald-700" : "text-muted")}>{t(`status.${o.status}`)}</span>
                        {" · "}
                        {when(o.createdAt)}
                      </span>
                    </span>
                  </Link>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-[14px] font-bold text-ink tabular-nums">{formatRWF(o.total, locale)}</span>
                    <OrderAgain restaurantId={o.restaurant.id} items={o.items} compact />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {orders.length === 0 && nearby.length === 0 && (
          <EmptyState
            icon={<ShoppingBag />}
            title={t("noOrdersYet")}
            body={t("noOrdersYetBody")}
            action={
              <Link href="/restaurants" className="inline-flex items-center rounded-xl bg-primary px-7 py-3 text-[15px] font-semibold text-white">
                {t("browseRestaurants")}
              </Link>
            }
          />
        )}
        {orders.length === 0 && nearby.length > 0 && <p className="text-center text-[14px] text-muted">{t("noOrdersYetBody")}</p>}
      </div>
    </PageContainer>
  );
}
