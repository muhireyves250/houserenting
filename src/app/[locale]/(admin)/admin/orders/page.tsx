import { ShoppingBag, UtensilsCrossed } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageTabs } from "@/features/admin/components/kit";
import { FoodOrdersView } from "@/features/admin/views/FoodOrdersView";
import { RestaurantsView } from "@/features/admin/views/RestaurantsView";
import { requireAdmin } from "@/lib/permissions";

type Props = { searchParams: Promise<{ tab?: string; status?: string }> };

/** Food on one page: guests' orders in one tab, the restaurants (and their menus) in the other. */
export default async function FoodPage({ searchParams }: Props) {
  await requireAdmin("/admin/orders");
  const params = await searchParams;
  const restaurants = params.tab === "restaurants";
  const t = await getTranslations("Admin");
  const tabs = (
    <PageTabs
      label={t("nav.orders")}
      items={[
        { key: "orders", label: t("pageTabs.orders"), short: t("pageTabs.ordersShort"), icon: ShoppingBag, href: { pathname: "/admin/orders" }, on: !restaurants },
        { key: "restaurants", label: t("pageTabs.restaurants"), icon: UtensilsCrossed, href: { pathname: "/admin/orders", query: { tab: "restaurants" } }, on: restaurants },
      ]}
    />
  );
  return restaurants ? <RestaurantsView searchParams={Promise.resolve(params)} tabs={tabs} /> : <FoodOrdersView tabs={tabs} />;
}
