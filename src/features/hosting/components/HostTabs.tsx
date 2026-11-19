import { ChefHat, LayoutDashboard, UtensilsCrossed, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SlidingTabs } from "@/features/admin/components/SlidingTabs";

/** The owner's dashboard sections, sliding like the login / sign-up switch. Kitchens only for kitchen teams. */
export async function HostTabs({ on, kitchens = false }: { on: "overview" | "orders" | "payout" | "restaurants"; kitchens?: boolean }) {
  const t = await getTranslations("Host.dash");
  const items = [
    { key: "overview", label: t("tabs.overview"), icon: <LayoutDashboard aria-hidden="true" />, href: "/host", on: on === "overview" },
    { key: "orders", label: t("tabs.orders"), short: t("tabs.ordersShort"), icon: <UtensilsCrossed aria-hidden="true" />, href: "/host/orders", on: on === "orders" },
    { key: "payout", label: t("tabs.payout"), icon: <Wallet aria-hidden="true" />, href: "/host/payout", on: on === "payout" },
    ...(kitchens || on === "restaurants" ? [{ key: "restaurants", label: t("tabs.restaurants"), icon: <ChefHat aria-hidden="true" />, href: "/host/restaurants", on: on === "restaurants" }] : []),
  ];
  return <SlidingTabs label={t("tabs.overview")} items={items} />;
}
