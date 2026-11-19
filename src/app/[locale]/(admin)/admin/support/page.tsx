import { LifeBuoy, MessageSquareWarning } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { attentionCounts } from "@/features/admin/stats";
import { ModerationView } from "@/features/admin/views/ModerationView";
import { SupportView } from "@/features/admin/views/SupportView";
import { PageTabs } from "@/features/admin/components/kit";
import { requireStaff } from "@/lib/permissions";

type Props = { searchParams: Promise<{ tab?: string; status?: string; show?: string }> };

/** Support and reviews on one page: help requests in one tab, guests' questions and feedback in the other. */
export default async function SupportAndReviewsPage({ searchParams }: Props) {
  await requireStaff("support", "/admin/support");
  const params = await searchParams;
  const reviews = params.tab === "reviews";
  const [t, counts] = await Promise.all([getTranslations("Admin"), attentionCounts()]);
  const tabs = (
    <PageTabs
      label={t("nav.support")}
      items={[
        { key: "requests", label: t("supportTabs.requests"), short: t("supportTabs.short.requests"), icon: LifeBuoy, href: { pathname: "/admin/support" }, on: !reviews, count: counts.tickets },
        { key: "reviews", label: t("supportTabs.reviews"), short: t("supportTabs.short.reviews"), icon: MessageSquareWarning, href: { pathname: "/admin/support", query: { tab: "reviews" } }, on: reviews, count: counts.moderation },
      ]}
    />
  );
  return reviews ? <ModerationView showPublished={params.show === "published"} tabs={tabs} /> : <SupportView raw={params.status} tabs={tabs} />;
}
