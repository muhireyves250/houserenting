import { ArrowRight, UtensilsCrossed } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { Dish } from "@/features/food/service";
import { Link } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";

/** Home page: a swipeable shelf of dishes; every dish opens the FOOD menu, where guests order to their room. */
export async function FoodShelf({ dishes, place }: { dishes: Dish[]; place: string | null }) {
  const [t, locale] = await Promise.all([getTranslations("Food"), getLocale()]);
  return (
    <section aria-labelledby="food-shelf">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="food-shelf" className="text-[20px] leading-7 font-bold tracking-[-0.02em] text-ink md:text-[24px] md:leading-8">
            {t("homeMenuTitle")}
          </h2>
          <p className="text-[13px] text-muted md:text-[14px]">{place ? t("orderFoodSub", { place }) : t("homeMenuSub")}</p>
        </div>
        <Link href="/food" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover">
          {place ? t("orderNow") : t("seeMenu")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 md:scroll-px-0 [scrollbar-width:none] md:mx-0 md:px-0">
        {dishes.map((dish) => (
          <li key={dish.id} className="w-[42%] shrink-0 snap-start sm:w-[30%] md:w-[19%] lg:w-[15.5%]">
            <Link href="/food" className="group block">
              <span className="relative block aspect-square overflow-hidden rounded-2xl bg-primary-soft">
                {dish.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- menu photo from the kitchen's Cloudinary upload
                  <img src={dish.photoUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <UtensilsCrossed className="absolute inset-0 m-auto size-8 text-primary" aria-hidden="true" />
                )}
              </span>
              <span className="mt-2 block truncate text-[14px] font-semibold text-ink">{dish.name}</span>
              <span className="block text-[13px] text-muted tabular-nums">{formatRWF(dish.price, locale)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
