import { Bike, Clock, MapPin, Search, UtensilsCrossed } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { NearMe } from "@/features/food/components/NearMe";
import { restaurantsNear } from "@/features/food/service";
import { myStay } from "@/features/stay/service";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

type Filter = "all" | "delivery" | "pickup" | "open";
type Props = { searchParams: Promise<{ lat?: string; lng?: string; q?: string; f?: string }> };

export async function generateMetadata() {
  const t = await getTranslations("Food");
  return { title: t("restaurantsTitle") };
}

const coord = (v: string | undefined, min: number, max: number) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/**
 * Restaurants nearest first (from the phone's location when shared, otherwise the guest's stay), as photo cards with
 * what matters to choose: ready time, delivery fee, distance. Search and quick filters.
 */
export default async function RestaurantsPage({ searchParams }: Props) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const stay = user ? (await myStay(user.id)).current : null;
  const lat = coord(params.lat, -90, 90);
  const lng = coord(params.lng, -180, 180);
  const point = lat !== null && lng !== null ? { lat, lng } : stay ? { lat: stay.listing.lat, lng: stay.listing.lng } : null;
  const q = (params.q ?? "").trim().slice(0, 60);
  const filter: Filter = (["delivery", "pickup", "open"] as const).find((f) => f === params.f) ?? "all";
  const [t, locale, all] = await Promise.all([getTranslations("Food"), getLocale(), restaurantsNear(point, stay?.listing.id ?? null)]);
  const needle = q.toLowerCase();
  const list = all.filter(
    (r) =>
      (!needle || `${r.name} ${r.description} ${r.district} ${r.city}`.toLowerCase().includes(needle)) &&
      (filter === "all" || (filter === "delivery" && r.delivery) || (filter === "pickup" && r.pickup) || (filter === "open" && !r.paused)),
  );
  // Keep location and search when switching filters.
  const keep = Object.fromEntries(Object.entries({ lat: params.lat, lng: params.lng, q: q || undefined }).filter(([, v]) => v)) as Record<string, string>;
  const km = (n: number) => t("km", { km: n < 10 ? n.toFixed(1) : Math.round(n) });

  return (
    <PageContainer className="max-w-5xl pt-5 pb-10 md:py-10">
      <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("restaurantsTitle")}</h1>
      <p className="mt-1 text-[14px] text-muted">{lat !== null ? t("sortedNearYou") : stay ? t("sortedNearStay", { place: stay.listing.title }) : t("restaurantsIntro")}</p>

      {/* Search, location and filters */}
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <form className="relative min-w-0 flex-1" action="">
            {Object.entries(keep)
              .filter(([k]) => k !== "q")
              .map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
            {filter !== "all" && <input type="hidden" name="f" value={filter} />}
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder={t("searchRestaurants")}
              aria-label={t("searchRestaurants")}
              className="w-full rounded-full border border-line bg-surface py-2.5 pr-4 pl-10 text-[15px] text-ink outline-none focus:border-primary"
            />
          </form>
          <NearMe compact />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          {(["all", "delivery", "pickup", "open"] as const).map((f) => (
            <Link
              key={f}
              href={{ pathname: "/restaurants", query: { ...keep, ...(f === "all" ? {} : { f }) } }}
              scroll={false}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
                filter === f ? "bg-ink text-white" : "bg-surface text-ink ring-1 ring-line hover:ring-primary",
              )}
            >
              {t(`filter.${f}`)}
            </Link>
          ))}
        </div>
      </div>

      {all.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon={<UtensilsCrossed />} title={t("noRestaurants")} body={t("noRestaurantsBody")} />
        </div>
      ) : list.length === 0 ? (
        <p className="py-12 text-center text-[15px] text-muted">{t("noRestaurantMatch")}</p>
      ) : (
        <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => (
            <li key={r.id}>
              <Link
                href={`/restaurants/${r.id}`}
                className={cn(
                  "group block overflow-hidden rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] transition-transform active:scale-[0.98] max-md:ring-line",
                  r.paused && "opacity-75",
                )}
              >
                <span className="relative block aspect-[16/9] bg-primary-soft">
                  {r.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- restaurant photo from Cloudinary or a demo image
                    <img src={r.photoUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <UtensilsCrossed className="absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-primary/50" aria-hidden="true" />
                  )}
                  <span className="absolute top-3 left-3 flex gap-1.5">
                    {r.atYourStay && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow">{t("atYourStay")}</span>}
                    {r.paused && <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-white shadow">{t("closedNow")}</span>}
                  </span>
                </span>
                <span className="block p-4">
                  <span className="block truncate text-[17px] font-bold text-ink">{r.name}</span>
                  {r.description && <span className="mt-0.5 block truncate text-[13px] text-muted">{r.description}</span>}
                  <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5 text-primary" aria-hidden="true" />
                      {t("aboutMinutes", { minutes: r.prepMinutes })}
                    </span>
                    {r.delivery && (
                      <span className="inline-flex items-center gap-1">
                        <Bike className="size-3.5 text-primary" aria-hidden="true" />
                        {r.deliveryFee > 0 ? formatRWF(r.deliveryFee, locale) : t("free")}
                      </span>
                    )}
                    {!r.delivery && <span className="text-muted">{t("pickupOnly")}</span>}
                    {r.km !== null && !r.atYourStay && (
                      <span className="inline-flex items-center gap-1 text-muted">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {km(r.km)}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
