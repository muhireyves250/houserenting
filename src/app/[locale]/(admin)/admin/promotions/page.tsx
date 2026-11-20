import { BadgePercent, QrCode } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageTabs, StickyTabs } from "@/features/admin/components/kit";
import { PromotersView } from "@/features/admin/views/PromotersView";
import { PromotionsView } from "@/features/admin/views/PromotionsView";
import { requireStaff } from "@/lib/permissions";

type Props = { searchParams: Promise<{ tab?: string; for?: string }> };

/** Promotions on one page: promo codes in one tab, promoters and their rewards in the other. */
export default async function PromotionsPage({ searchParams }: Props) {
  await requireStaff("promotions", "/admin/promotions");
  const params = await searchParams;
  const promoters = params.tab === "promoters";
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
  // "Give a promo code" from a promoter card opens the form with that promoter chosen.
  if (!promoters) return <PromotionsView tabs={tabs} forPromoter={params.for} />;
  return (
    <div className="flex flex-col gap-5">
      <StickyTabs>{tabs}</StickyTabs>
      <PromotersView />
    </div>
  );
}
