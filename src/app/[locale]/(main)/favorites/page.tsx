import { Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { requireUser } from "@/lib/session";

export default async function FavoritesPage() {
  await requireUser("/favorites");
  const t = await getTranslations("Empty");
  const tNav = await getTranslations("Nav");
  return (
    <PageContainer className="py-6">
      <h1 className="text-2xl font-semibold">{tNav("favorites")}</h1>
      <EmptyState icon={<Heart />} title={t("favoritesTitle")} body={t("favoritesBody")} />
    </PageContainer>
  );
}
