import { ChevronLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EMPTY_RESTAURANT, RestaurantForm } from "@/features/food/components/RestaurantForm";
import { Link, redirect } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function NewRestaurantPage() {
  const user = await requireUser("/host/restaurants/new");
  const [t, places] = await Promise.all([
    getTranslations("Food"),
    db.listing.findMany({ where: { hostId: user.id, status: { not: "ARCHIVED" } }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  // Only property owners add restaurants themselves; everyone else is sent to the list, which explains it.
  if (places.length === 0) redirect({ href: "/host/restaurants", locale: await getLocale() });
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/host/restaurants" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("yourRestaurants")}
      </Link>
      <h2 className="mb-2 text-[22px] leading-7 font-bold tracking-[-0.03em] text-ink md:text-[24px] md:leading-8">{t("addRestaurant")}</h2>
      <p className="mb-6 text-[15px] text-muted">{t("addRestaurantIntro")}</p>
      <RestaurantForm restaurantId={null} initial={EMPTY_RESTAURANT} places={places} after="/host/restaurants" />
    </div>
  );
}
