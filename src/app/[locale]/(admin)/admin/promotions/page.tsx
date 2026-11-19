import { BadgePercent, QrCode } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageTabs, StickyTabs } from "@/features/admin/components/kit";
import { PromotersView } from "@/features/admin/views/PromotersView";
import { PromotionsView } from "@/features/admin/views/PromotionsView";
import { requireAdmin } from "@/lib/permissions";

type Props = { searchParams: Promise<{ tab?: string }> };

/** Promotions on one page: promo codes in one tab, promoters and their rewards in the other. */
export default async function PromotionsPage({ searchParams }: Props) {
  await requireAdmin("/admin/promotions");
  const promoters = (await searchParams).tab === "promoters";
  const t = await getTranslations("Admin");
  const tabs = (
    <PageTabs
      label={t("nav.promotions")}
      items={[
        { key: "codes", label: t("pageTabs.promoCodes"), short: t("pageTabs.promoCodesShort"), icon: BadgePercent, href: { pathname: "/admin/promotions" }, on: !promoters },
        { key: "promoters", label: t("pageTabs.promoters"), icon: QrCode, href: { pathname: "/admin/promotions", query: { tab: "promoters" } }, on: promoters },
      ]}
    />
  );
  // Promo codes fill the screen (form and list side by side); promoters are an ordinary page.
  if (!promoters) return <PromotionsView tabs={tabs} />;
  return (
    <div className="flex flex-col gap-5">
      <StickyTabs>{tabs}</StickyTabs>
      <PromotersView />
    </div>
  );
}
