import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { PageContainer } from "@/components/ui/PageContainer";
import { AdminNav } from "@/features/admin/components/AdminNav";
import { dashboardCounts } from "@/features/admin/service";
import { requireAdmin } from "@/lib/permissions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Staff area: every page under it is checked for the admin role on the server. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin("/admin");
  const [t, counts] = await Promise.all([getTranslations("Admin"), dashboardCounts()]);
  return (
    <PageContainer className="max-w-5xl py-6 md:py-10">
      <h1 className="mb-4 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("title")}</h1>
      <AdminNav counts={{ overview: counts.listings, moderation: counts.questions + counts.reviews, support: counts.tickets }} />
      {children}
    </PageContainer>
  );
}
