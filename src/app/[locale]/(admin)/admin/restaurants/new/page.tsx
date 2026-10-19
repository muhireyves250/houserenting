import { getTranslations } from "next-intl/server";
import { PageIntro } from "@/features/admin/components/ui";
import { EMPTY_RESTAURANT, RestaurantForm } from "@/features/food/components/RestaurantForm";
import { requireAdmin } from "@/lib/permissions";

export default async function AdminNewRestaurantPage() {
  await requireAdmin("/admin/restaurants/new");
  const t = await getTranslations("Food");
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageIntro back={{ href: "/admin/restaurants", label: t("restaurantsTitle") }} description={t("adminNewIntro")} />
      <RestaurantForm restaurantId={null} initial={EMPTY_RESTAURANT} places={[]} staffNew after="/admin/restaurants" />
    </div>
  );
}
