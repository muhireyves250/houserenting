import { Building2, MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { parseSearchParams } from "@/features/search/params";

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseSearchParams(await searchParams);
  const t = await getTranslations("Search");
  const tHome = await getTranslations("Home");

  return (
    <PageContainer className="py-6">
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <MapPin className="size-5" aria-hidden="true" />
        <h1 className="font-medium">{query.location ?? t("anywhere")}</h1>
        <span className="ml-auto rounded-full bg-surface px-3 py-1 text-xs">{query.mode === "short" ? tHome("short") : tHome("long")}</span>
      </div>
      <EmptyState icon={<Building2 />} title={t("emptyTitle")} body={t("emptyBody")} />
    </PageContainer>
  );
}
