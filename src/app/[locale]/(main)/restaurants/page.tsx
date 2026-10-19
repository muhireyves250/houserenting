import { Bike, ChevronRight, Store, UtensilsCrossed } from "lucide-react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { NearMe } from "@/features/food/components/NearMe";
import { restaurantsNear } from "@/features/food/service";
import { myStay } from "@/features/stay/service";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/session";

type Props = { searchParams: Promise<{ lat?: string; lng?: string }> };

export async function generateMetadata() {
  const t = await getTranslations("Food");
  return { title: t("restaurantsTitle") };
}

const coord = (v: string | undefined, min: number, max: number) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/** Restaurants nearest first: from the phone's location when shared, otherwise from the guest's current stay. */
export default async function RestaurantsPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const stay = user ? (await myStay(user.id)).current : null;
  const lat = coord(params.lat, -90, 90);
  const lng = coord(params.lng, -180, 180);
  const point = lat !== null && lng !== null ? { lat, lng } : stay ? { lat: stay.listing.lat, lng: stay.listing.lng } : null;
  const [t, list] = await Promise.all([getTranslations("Food"), restaurantsNear(point, stay?.listing.id ?? null)]);

  return (
    <PageContainer className="max-w-3xl py-6 md:py-10">
      <h1 className="mb-1 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("restaurantsTitle")}</h1>
      <p className="mb-4 text-[15px] text-muted">{lat !== null ? t("sortedNearYou") : stay ? t("sortedNearStay", { place: stay.listing.title }) : t("restaurantsIntro")}</p>
      <div className="mb-5">
        <NearMe />
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed />} title={t("noRestaurants")} body={t("noRestaurantsBody")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((r) => (
            <li key={r.id}>
              <Link
                href={`/restaurants/${r.id}`}
                className="flex items-center gap-4 rounded-3xl bg-surface p-3 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] transition-transform active:scale-[0.98] max-md:ring-line"
              >
                <span className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary">
                  {r.photoUrl ? <Image src={r.photoUrl} alt="" fill sizes="80px" className="object-cover" unoptimized /> : <UtensilsCrossed className="size-7" aria-hidden="true" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[16px] font-semibold text-ink">{r.name}</span>
                  <span className="truncate text-[13px] text-muted">
                    {r.district}, {r.city}
                    {r.km !== null && !r.atYourStay && ` · ${t("km", { km: r.km < 10 ? r.km.toFixed(1) : Math.round(r.km) })}`}
                  </span>
                  <span className="flex flex-wrap gap-1.5 pt-1 text-xs font-semibold">
                    {r.atYourStay && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">{t("atYourStay")}</span>}
                    {r.paused && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">{t("closedNow")}</span>}
                    {r.delivery && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-ink">
                        <Bike className="size-3.5" aria-hidden="true" />
                        {t("fulfilment.DELIVERY")}
                      </span>
                    )}
                    {r.pickup && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-0.5 text-ink">
                        <Store className="size-3.5" aria-hidden="true" />
                        {t("fulfilment.PICKUP")}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-ink/50" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
