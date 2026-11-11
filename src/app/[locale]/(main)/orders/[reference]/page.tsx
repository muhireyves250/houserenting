import { BedDouble, Bike, CheckCircle2, ChefHat, CircleX, Clock, CreditCard, LifeBuoy, PackageCheck, Receipt, Store, type LucideIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHero } from "@/components/shell/PageHero";
import { PageContainer } from "@/components/ui/PageContainer";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { AutoRefresh } from "@/features/food/components/AutoRefresh";
import { CancelOrder } from "@/features/food/components/CancelOrder";
import { OrderAgain } from "@/features/food/components/OrderAgain";
import { OrderPayment } from "@/features/food/components/OrderPayment";
import { OrderProgress } from "@/features/food/components/OrderProgress";
import { RemoveOrder } from "@/features/food/components/RemoveOrder";
import { ACTIVE_ORDER, type OrderStatus } from "@/features/food/rules";
import { myOrder } from "@/features/food/service";
import { getSettings } from "@/features/settings/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { requireUser } from "@/lib/session";

type Props = { params: Promise<{ reference: string }> };

export async function generateMetadata({ params }: Props) {
  const t = await getTranslations("Food");
  return { title: t("orderTitle", { reference: (await params).reference }) };
}

const card = "rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line";

/** The picture and colour for each moment of an order. */
const LOOK: Record<OrderStatus | "UNPAID", { icon: LucideIcon; tone: string }> = {
  UNPAID: { icon: CreditCard, tone: "bg-amber-100 text-amber-700" },
  PLACED: { icon: Receipt, tone: "bg-primary/10 text-primary" },
  ACCEPTED: { icon: CheckCircle2, tone: "bg-primary/10 text-primary" },
  PREPARING: { icon: ChefHat, tone: "bg-amber-100 text-amber-700" },
  READY: { icon: PackageCheck, tone: "bg-emerald-100 text-emerald-700" },
  OUT_FOR_DELIVERY: { icon: Bike, tone: "bg-emerald-100 text-emerald-700" },
  DELIVERED: { icon: CheckCircle2, tone: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { icon: CircleX, tone: "bg-red-100 text-red-700" },
};

/**
 * One order. Pay-first orders start with paying (mobile money, confirmed by VIIPA) before the kitchen starts;
 * then where it is (updates by itself) and when it arrives. Cancelled orders say why and can be removed.
 */
export default async function OrderPage({ params }: Props) {
  const { reference } = await params;
  const user = await requireUser(`/orders/${reference}`);
  const order = await myOrder(user.id, reference);
  if (!order) notFound();
  const [t, locale, settings] = await Promise.all([getTranslations("Food"), getLocale(), getSettings()]);
  const cancelled = order.status === "CANCELLED";
  const payFirst = order.paymentMethod === "PAY_FIRST" && order.total > 0;
  const unpaid = payFirst && !order.paidAt && !cancelled;
  const active = ACTIVE_ORDER.includes(order.status);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });
  // Counted from the payment for pay-first orders (the kitchen starts then).
  const start = order.paidAt ?? order.createdAt;
  const eta = new Date(start.getTime() + (order.restaurant.prepMinutes + (order.fulfilment === "DELIVERY" ? 20 : 0)) * 60_000);
  const look = LOOK[unpaid ? "UNPAID" : order.status];
  const StatusIcon = look.icon;
  const Service = order.fulfilment === "DELIVERY" ? Bike : order.fulfilment === "TO_STAY" ? BedDouble : Store;
  const place = order.address?.split(" · ")[0] || t("yourStayKitchen");
  const headline = unpaid ? (order.paymentClaim ? t("pay.checkingTitle") : t("pay.title")) : t(`statusTitle.${order.status}`);

  return (
    <PageContainer className="max-w-2xl pt-4 pb-10 max-md:pt-0 md:py-10">
      <AutoRefresh active={active || unpaid} />
      <PageHero title={t("ordersTitle")} icon={Receipt} subtitle={<span className="font-mono">{order.reference}</span>} />
      <Link href="/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink max-md:hidden">
        ← {t("ordersTitle")}
      </Link>

      {/* Where it is now */}
      <section className={cn(card, "p-5 md:p-6", cancelled && "ring-red-200")}>
        <div className="flex items-start gap-4">
          <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl", look.tone)}>
            <StatusIcon className={cn("size-7", active && !unpaid && "motion-safe:animate-pulse")} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[21px] leading-7 font-bold tracking-[-0.02em] text-ink md:text-[24px] md:leading-8">{headline}</h1>
            <p className="text-[13px] text-muted">
              <span className="font-mono">{order.reference}</span> · {formatKigaliDateTime(locale, order.createdAt)}
            </p>
          </div>
        </div>

        {unpaid && (
          <div className="mt-5">
            <OrderPayment reference={order.reference} amount={order.total} instructions={settings.paymentInstructions} claimed={order.paymentClaim} />
            <p className="mt-3 text-center text-[12px] text-muted">{t("pay.kitchenWaits")}</p>
          </div>
        )}

        {!unpaid && active && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-canvas px-4 py-3">
            <span className="inline-flex items-center gap-2 text-[14px] text-muted">
              <Clock className="size-4 text-primary" aria-hidden="true" />
              {order.fulfilment === "PICKUP" ? t("readyBy") : t("arrivesBy")}
            </span>
            <span className="text-[24px] leading-7 font-bold text-ink tabular-nums">{time.format(eta)}</span>
          </div>
        )}

        {cancelled && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-[14px] text-red-900">{order.cancelReason ? t("cancelledBecause", { reason: order.cancelReason }) : t("cancelledNoReason")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <OrderAgain restaurantId={order.restaurant.id} items={order.items} />
              <RemoveOrder reference={order.reference} backToList />
            </div>
          </div>
        )}

        {!cancelled && (
          <div className="mt-5">
            <OrderProgress status={order.status} fulfilment={order.fulfilment} payFirst={payFirst ? { paid: Boolean(order.paidAt) } : null} />
          </div>
        )}
        {(active || unpaid) && <p className="mt-4 text-center text-xs text-muted">{t("updatesItself")}</p>}
      </section>

      {/* Where it's cooked and where it goes */}
      <section className={cn(card, "mt-4 p-5")}>
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <Service className="size-6" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-[14px]">
            <b className="block text-[16px] font-bold text-ink">{t("kitchenAt", { place })}</b>
            <span className="block text-muted">{order.address ?? t(`fulfilment.${order.fulfilment}`)}</span>
          </span>
        </div>
      </section>

      {/* What's in it */}
      <section className={cn(card, "mt-4 p-5")}>
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
          <div className="flex items-center justify-between pt-1 text-[16px] font-bold">
            <dt>{t("total")}</dt>
            <dd className="flex items-center gap-2 tabular-nums">
              {formatRWF(order.total, locale)}
              {order.paidAt && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">{t("status.PAID")}</span>}
            </dd>
          </div>
        </dl>
        {!payFirst && <p className="mt-2 text-xs text-muted">{t("payOnDeliveryOld")}</p>}
        {order.note && <p className="mt-2 text-[13px] text-muted">{t("yourNote", { note: order.note })}</p>}
        <details className="mt-3 border-t border-line pt-3 text-[13px] text-muted">
          <summary className="cursor-pointer font-semibold text-ink">{t("history")}</summary>
          <ol className="mt-2 flex flex-col gap-1">
            {order.paidAt && <li>{t("status.PAID")} · {formatKigaliDateTime(locale, order.paidAt)}</li>}
            {order.events.map((e) => (
              <li key={e.id}>
                {t(`status.${e.to}`)} · {formatKigaliDateTime(locale, e.createdAt)}
                {e.note && ` · ${e.note}`}
              </li>
            ))}
          </ol>
        </details>
      </section>

      <section className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-4">
          {order.status === "PLACED" && !order.paidAt && <CancelOrder reference={order.reference} />}
          {!active && !cancelled && <OrderAgain restaurantId={order.restaurant.id} items={order.items} />}
        </span>
        <Link href={{ pathname: "/support", query: { order: order.reference } }} className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary hover:underline">
          <LifeBuoy className="size-4" aria-hidden="true" />
          {t("orderHelp")}
        </Link>
      </section>
    </PageContainer>
  );
}
