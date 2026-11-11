import { Heart } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/ui/PageLoading";

/** Shown the first time this page opens, in the page's own layout, while its data loads. */
export default async function Loading() {
  const t = await getTranslations("Nav");
  return <PageLoading title={t("favorites")} icon={Heart} shape="grid" wide />;
}
