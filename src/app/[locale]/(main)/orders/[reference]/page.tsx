import { Bike, BedDouble, ChevronLeft, Clock, MapPin, Phone, Store } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { AutoRefresh } from "@/features/food/components/AutoRefresh";
import { CancelOrder } from "@/features/food/components/CancelOrder";
import { OrderAgain } from "@/features/food/components/OrderAgain";
import { OrderProgress } from "@/features/food/components/OrderProgress";
import { ACTIVE_ORDER } from "@/features/food/rules";
import { myOrder } from "@/features/food/service";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { requireUser } from "@/lib/session";

type Props = { params: Promise<{ reference: string }> };

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations("Food");
  return { title: t("orderTitle", { reference: (await params).reference }) };
}

/** One order: where it is now (updates by itself), what's in it, how it arrives, and who to call. */
export default async function OrderPage({ params }: Props) {
  const { reference } = await params;
  const user = await requireUser(`/orders/${reference}`);
  const order = await myOrder(user.id, reference);
  if (!order) notFound();
  const [t, locale] = await Promise.all([getTranslations("Food"), getLocale()]);
  const active = ACTIVE_ORDER.includes(order.status);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });
  const eta = new Date(order.createdAt.getTime() + (order.restaurant.prepMinutes + (order.fulfilment === "DELIVERY" ? 20 : 0)) * 60_000);
  const card = "rounded-3xl bg-surface p-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line md:p-6";
  const Icon = order.fulfilment === "DELIVERY" ? Bike : order.fulfilment === "TO_STAY" ? BedDouble : Store;

  return (
    <PageContainer className="max-w-2xl py-6 md:py-10">
      <AutoRefresh active={active} />
      <Link href="/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("ordersTitle")}
      </Link>

      <section className={card}>
        <p className="text-[13px] text-muted">
          <span className="font-mono">{order.reference}</span> · {formatKigaliDateTime(locale, order.createdAt)}
        </p>
        <h1 className="mt-1 text-[24px] leading-8 font-bold tracking-[-0.02em] text-ink">
          {order.status === "CANCELLED" ? t("statusTitle.CANCELLED") : order.status === "DELIVERED" ? t("statusTitle.DELIVERED") : t(`statusTitle.${order.status}`)}
        </h1>
        {active && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-[15px] text-ink">
            <Clock className="size-4 text-primary" aria-hidden="true" />
            {order.fulfilment === "PICKUP" ? t("readyAround", { time: time.format(eta) }) : t("arrivesAround", { time: time.format(eta) })}
          </p>
        )}
        {order.status === "CANCELLED" && order.cancelReason && <p className="mt-1 text-[14px] text-muted">{t("cancelledBecause", { reason: order.cancelReason })}</p>}
        {order.status !== "CANCELLED" && (
          <div className="mt-5">
            <OrderProgress status={order.status} fulfilment={order.fulfilment} />
          </div>
        )}
        {active && <p className="mt-4 text-center text-xs text-muted">{t("updatesItself")}</p>}
      </section>

      <section className={`${card} mt-4`}>
        <h2 className="text-[17px] font-bold text-ink">{order.restaurant.name}</h2>
        <p className="mt-2 inline-flex items-start gap-2 text-[14px] text-ink">
          <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <b className="font-semibold">{t(`fulfilment.${order.fulfilment}`)}</b>
            {order.fulfilment === "PICKUP" ? (
              <span className="block text-muted">
                {order.restaurant.addressLine}, {order.restaurant.district}, {order.restaurant.city}
              </span>
            ) : (
              order.address && <span className="block text-muted">{order.address}</span>
            )}
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {order.restaurant.phone && (
            <a href={`tel:${order.restaurant.phone}`} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover">
              <Phone className="size-4" aria-hidden="true" />
              {t("callRestaurant")}
            </a>
          )}
          {order.fulfilment === "PICKUP" && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${order.restaurant.lat},${order.restaurant.lng}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-ink hover:border-primary"
            >
              <MapPin className="size-4" aria-hidden="true" />
              {t("directions")}
            </a>
          )}
        </div>
      </section>

      <section className={`${card} mt-4`}>
        <h2 className="mb-2 text-[17px] font-bold text-ink">{t("yourOrderTitle")}</h2>
        <ul className="flex flex-col divide-y divide-line text-[14px]">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2">
              <span>
                <b className="font-semibold tabular-nums">{i.quantity} ×</b> {i.name}
              </span>
              <span className="tabular-nums">{formatRWF(i.price * i.quantity, locale)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 flex flex-col gap-1 border-t border-line pt-3 text-[14px]">
          <div className="flex justify-between">
            <dt className="text-muted">{t("subtotal")}</dt>
            <dd className="tabular-nums">{formatRWF(order.subtotal, locale)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t("deliveryFeeLine")}</dt>
            <dd className="tabular-nums">{order.deliveryFee > 0 ? formatRWF(order.deliveryFee, locale) : t("free")}</dd>
          </div>
          <div className="flex justify-between pt-1 text-[16px] font-bold">
            <dt>{t("total")}</dt>
            <dd className="tabular-nums">{formatRWF(order.total, locale)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted">{t("payOnDelivery")}</p>
        {order.note && <p className="mt-2 text-[13px] text-muted">{t("yourNote", { note: order.note })}</p>}
      </section>

      <section className="mt-4 flex flex-wrap items-center gap-4">
        {order.status === "PLACED" && <CancelOrder reference={order.reference} />}
        {!active && <OrderAgain restaurantId={order.restaurant.id} items={order.items} />}
      </section>

      <details className="mt-6 text-[13px] text-muted">
        <summary className="cursor-pointer font-semibold">{t("history")}</summary>
        <ol className="mt-2 flex flex-col gap-1">
          {order.events.map((e) => (
            <li key={e.id}>
              {t(`status.${e.to}`)} · {formatKigaliDateTime(locale, e.createdAt)}
              {e.note && ` · ${e.note}`}
            </li>
          ))}
        </ol>
      </details>
    </PageContainer>
  );
}
