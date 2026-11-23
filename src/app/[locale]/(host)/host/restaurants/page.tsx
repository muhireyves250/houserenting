import { ChevronLeft, ChevronRight, Plus, UtensilsCrossed } from "lucide-react";
import { requireWorkArea } from "@/features/hosting/work";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { canAddRestaurant, restaurantsRunBy } from "@/features/food/service";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  const t = await getTranslations("Food");
  return { title: t("yourRestaurants") };
}

/** Restaurants someone owns or works at (manager, kitchen, delivery). */
export default async function HostRestaurantsPage() {
  const { user } = await requireWorkArea("restaurants", "/host/restaurants");
  const [t, list, canAdd] = await Promise.all([getTranslations("Food"), restaurantsRunBy(user.id), canAddRestaurant(user)]);
  const add = (
    <Link href="/host/restaurants/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-primary-hover">
      <Plus className="size-4" aria-hidden="true" />
      {t("addRestaurant")}
    </Link>
  );
  // The dashboard's own margins (full width), restaurants as cards side by side on wide screens.
  return (
    <div>
      <Link href="/host" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("backToHosting")}
      </Link>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-[22px] leading-7 font-bold tracking-[-0.03em] text-ink md:text-[24px] md:leading-8">{t("yourRestaurants")}</h2>
        {list.length > 0 && canAdd && add}
      </div>
      {list.length === 0 ? (
        <EmptyState
          icon={<UtensilsCrossed />}
          title={t("noOwnRestaurants")}
          body={canAdd ? t("noOwnRestaurantsBody") : t("ownersOnly")}
          action={
            canAdd ? (
              add
            ) : (
              <Link href="/restaurants" className="inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-[15px] font-semibold text-white">
                {t("browseRestaurants")}
              </Link>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => (
            <li key={r.id}>
              <Link href={`/host/restaurants/${r.id}`} className="flex h-full items-center justify-between gap-3 rounded-2xl bg-surface px-5 py-4 ring-1 ring-line transition-shadow hover:shadow-md hover:ring-primary/40">
                <span>
                  <span className="block text-[15px] font-semibold text-ink">{r.name}</span>
                  <span className="block text-[13px] text-muted">
                    {t(`role.${r.role}`)} · {r.city} · {t(`restaurantStatus.${r.status}`)}
                    {r.paused && ` · ${t("closedNow")}`}
                  </span>
                </span>
                <ChevronRight className="size-5 text-ink/50" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
