import { ChevronRight, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { AutoRefresh } from "@/features/food/components/AutoRefresh";
import { OrderAgain } from "@/features/food/components/OrderAgain";
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

/** ORDERS: orders in progress first (they update by themselves), then past ones with "Order again". */
export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const [t, locale, orders] = await Promise.all([getTranslations("Food"), getLocale(), myOrders(user.id)]);
  const current = orders.filter((o) => ACTIVE_ORDER.includes(o.status));
  const past = orders.filter((o) => !ACTIVE_ORDER.includes(o.status));

  const row = (o: (typeof orders)[number]) => (
    <li key={o.id} className="rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
      <Link href={`/orders/${o.reference}`} className="flex items-center gap-3 p-4">
        <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary">
          {o.restaurant.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- restaurant photo thumbnail
            <img src={o.restaurant.photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <UtensilsCrossed className="size-6" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-ink">{o.restaurant.name}</span>
          <span className="block truncate text-[13px] text-muted">{o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</span>
          <span className="block text-xs text-muted">
            {formatKigaliDateTime(locale, o.createdAt)} · {formatRWF(o.total, locale)}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
              ACTIVE_ORDER.includes(o.status) ? "bg-primary/10 text-primary" : o.status === "DELIVERED" ? "bg-emerald-50 text-emerald-800" : "bg-canvas text-muted",
            )}
          >
            {t(`status.${o.status}`)}
          </span>
          <ChevronRight className="size-4 text-ink/40" aria-hidden="true" />
        </span>
      </Link>
      {!ACTIVE_ORDER.includes(o.status) && (
        <div className="border-t border-line px-4 py-2.5">
          <OrderAgain restaurantId={o.restaurant.id} items={o.items} />
        </div>
      )}
    </li>
  );

  return (
    <PageContainer className="max-w-2xl py-6 md:py-10">
      <AutoRefresh active={current.length > 0} seconds={20} />
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("ordersTitle")}</h1>
        {orders.length > 0 && (
          <Link href="/restaurants" className="rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-ink hover:border-primary">
            {t("browseRestaurants")}
          </Link>
        )}
      </div>
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
        <div className="flex flex-col gap-8">
          {current.length > 0 && (
            <section>
              <h2 className="mb-3 text-[17px] font-bold text-ink">{t("inProgress")}</h2>
              <ul className="flex flex-col gap-3">{current.map(row)}</ul>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-[17px] font-bold text-ink">{t("pastOrdersCustomer")}</h2>
              <ul className="flex flex-col gap-3">{past.map(row)}</ul>
            </section>
          )}
        </div>
      )}
    </PageContainer>
  );
}
