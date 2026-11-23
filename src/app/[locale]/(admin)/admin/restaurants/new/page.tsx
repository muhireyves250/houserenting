import { getTranslations } from "next-intl/server";
import { PageIntro } from "@/features/admin/components/ui";
import { EMPTY_RESTAURANT, RestaurantForm } from "@/features/food/components/RestaurantForm";
import { requireStaff } from "@/lib/permissions";

export default async function AdminNewRestaurantPage() {
  await requireStaff("food", "/admin/restaurants/new");
  const t = await getTranslations("Food");
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageIntro back={{ href: "/admin/restaurants", label: t("restaurantsTitle") }} description={t("adminNewIntro")} />
      <RestaurantForm restaurantId={null} initial={EMPTY_RESTAURANT} staffNew after="/admin/restaurants" />
    </div>
  );
}
