import { ChevronLeft, ChevronRight, Plus, UtensilsCrossed } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { restaurantsRunBy } from "@/features/food/service";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("Food");
  return { title: t("yourRestaurants") };
}

/** Restaurants someone owns or works at (manager, kitchen, delivery). */
export default async function HostRestaurantsPage() {
  const user = await requireUser("/host/restaurants");
  const [t, list] = await Promise.all([getTranslations("Food"), restaurantsRunBy(user.id)]);
  const add = (
    <Link href="/host/restaurants/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-primary-hover">
      <Plus className="size-4" aria-hidden="true" />
      {t("addRestaurant")}
    </Link>
  );
  return (
    <PageContainer className="max-w-3xl py-6 md:py-10">
      <Link href="/host" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("backToHosting")}
      </Link>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("yourRestaurants")}</h1>
        {list.length > 0 && add}
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed />} title={t("noOwnRestaurants")} body={t("noOwnRestaurantsBody")} action={add} />
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-3xl bg-surface ring-1 ring-line">
          {list.map((r) => (
            <li key={r.id}>
              <Link href={`/host/restaurants/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-4">
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
    </PageContainer>
  );
}
