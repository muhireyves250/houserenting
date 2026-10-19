import { ShoppingBag } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { CancelOrder } from "@/features/food/components/CancelOrder";
import { ACTIVE_ORDER } from "@/features/food/rules";
import { myOrders } from "@/features/food/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { requireUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("Food");
  return { title: t("ordersTitle") };
}

/** ORDERS: the customer's food orders with where each one is now. */
export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const [t, locale, orders] = await Promise.all([getTranslations("Food"), getLocale(), myOrders(user.id)]);
  return (
    <PageContainer className="max-w-2xl py-6 md:py-10">
      <h1 className="mb-6 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("ordersTitle")}</h1>
      {orders.length === 0 ? (
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
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((o) => {
            const active = ACTIVE_ORDER.includes(o.status);
            return (
              <li key={o.id} className="rounded-3xl bg-surface p-5 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span>
                    <span className="block text-[16px] font-semibold text-ink">{o.restaurant.name}</span>
                    <span className="block text-xs text-muted">
                      <span className="font-mono">{o.reference}</span> · {formatKigaliDateTime(locale, o.createdAt)} · {t(`fulfilment.${o.fulfilment}`)}
                    </span>
                  </span>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", active ? "bg-primary/10 text-primary" : o.status === "DELIVERED" ? "bg-emerald-50 text-emerald-800" : "bg-canvas text-muted")}>
                    {t(`status.${o.status}`)}
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-ink">{o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</p>
                <p className="text-[14px] font-semibold tabular-nums">{formatRWF(o.total, locale)}</p>
                {o.cancelReason && <p className="text-[13px] text-muted">{t("cancelledBecause", { reason: o.cancelReason })}</p>}
                {active && (
                  <ol className="mt-3 flex flex-wrap gap-1.5 text-xs">
                    {o.events.map((e) => (
                      <li key={e.id} className="rounded-full bg-canvas px-2.5 py-1 text-ink">
                        {t(`status.${e.to}`)} · {formatKigaliDateTime(locale, e.createdAt)}
                      </li>
                    ))}
                  </ol>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  {o.status === "PLACED" && <CancelOrder reference={o.reference} />}
                  {o.restaurant.phone && (
                    <a href={`tel:${o.restaurant.phone}`} className="text-[13px] font-semibold text-primary hover:underline">
                      {t("callRestaurant")}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
