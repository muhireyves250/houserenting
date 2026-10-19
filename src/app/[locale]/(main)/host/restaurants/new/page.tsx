import { ChevronLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { EMPTY_RESTAURANT, RestaurantForm } from "@/features/food/components/RestaurantForm";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function NewRestaurantPage() {
  const user = await requireUser("/host/restaurants/new");
  const [t, places] = await Promise.all([
    getTranslations("Food"),
    db.listing.findMany({ where: { hostId: user.id, status: { not: "ARCHIVED" } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  return (
    <PageContainer className="max-w-3xl py-6 md:py-10">
      <Link href="/host/restaurants" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("yourRestaurants")}
      </Link>
      <h1 className="mb-2 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("addRestaurant")}</h1>
      <p className="mb-6 text-[15px] text-muted">{t("addRestaurantIntro")}</p>
      <RestaurantForm restaurantId={null} initial={EMPTY_RESTAURANT} places={places} after="/host/restaurants" />
    </PageContainer>
  );
}
