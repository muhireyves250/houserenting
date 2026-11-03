import { BedDouble, Clock, KeyRound, UtensilsCrossed } from "lucide-react";
import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { MenuCart } from "@/features/food/components/MenuCart";
import { foodMenu, kitchenForPlace, type Dish } from "@/features/food/service";
import { myStay } from "@/features/stay/service";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("Food");
  return { title: t("foodTitle") };
}

/**
 * FOOD: the menu of the place the guest is staying at. The kitchen there cooks it and brings it to their room;
 * guests never choose a restaurant. Anyone can read the menu; ordering opens once their paid stay has started.
 */
export default async function FoodPage() {
  const user = await getCurrentUser();
  const [t, { current, today }] = await Promise.all([getTranslations("Food"), user ? myStay(user.id) : { current: null, today: "" }]);
  const paid = current && (current.status === "CONFIRMED" || current.status === "CHECKED_IN");
  const started = Boolean(paid && current && current.checkIn <= today);
  const kitchen = current ? await kitchenForPlace(current.listing.id) : null;

  const title = <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("foodTitle")}</h1>;

  // No stay, not paid yet, not started yet, or no kitchen at the place: say why and what to do, and still show the menu.
  if (!user || !current || !paid || !started || !kitchen || kitchen.menu.length === 0) {
    const reason = !current ? "noStay" : !paid ? "unpaid" : !started ? "notStarted" : "noKitchen";
    const menu = kitchen && kitchen.menu.length > 0 ? kitchen.menu : await foodMenu();
    return (
      <PageContainer className="max-w-4xl pt-5 pb-10 md:py-10">
        {title}
        <div className="mt-4 mb-6 flex flex-col gap-3 rounded-3xl bg-primary-soft p-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-surface text-primary">
              {reason === "noKitchen" ? <UtensilsCrossed className="size-5" aria-hidden="true" /> : <KeyRound className="size-5" aria-hidden="true" />}
            </span>
            <span className="text-[14px]">
              <b className="block text-[16px] font-bold text-ink">{t(`foodUnavailable.${reason}.title`)}</b>
              <span className="text-muted">{t(`foodUnavailable.${reason}.body`, { place: current?.listing.title ?? "", day: current?.checkIn ?? "" })}</span>
            </span>
          </span>
          <Link
            href={reason === "noStay" ? "/" : "/my-stay"}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary px-6 py-3 text-[15px] font-semibold text-white hover:bg-primary-hover"
          >
            {reason === "noStay" ? t("findPlace") : t("openMyStay")}
          </Link>
        </div>
        <MenuList dishes={menu} />
      </PageContainer>
    );
  }

  const phone = (await db.user.findUnique({ where: { id: user.id }, select: { phone: true } }))?.phone ?? null;
  const room = [current.listing.title, current.room?.name].filter(Boolean).join(" · ");

  return (
    <PageContainer className="max-w-6xl pt-5 pb-10 md:py-10">
      {title}
      <div className="mt-2 mb-5 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line">
          <BedDouble className="size-4 text-primary" aria-hidden="true" />
          {t("deliveredTo", { place: room })}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[13px] font-medium text-ink ring-1 ring-line">
          <Clock className="size-4 text-primary" aria-hidden="true" />
          {t("readyIn", { minutes: kitchen.prepMinutes })}
        </span>
        {kitchen.paused && <span className="rounded-full bg-amber-100 px-3 py-1.5 text-[13px] font-semibold text-amber-900">{t("kitchenClosed")}</span>}
      </div>
      <MenuCart
        restaurant={{ id: kitchen.id, pickup: false, delivery: false, deliveryFee: 0, paused: kitchen.paused, atYourStay: true, prepMinutes: kitchen.prepMinutes, minOrder: kitchen.minOrder }}
        menu={kitchen.menu}
        signedIn
        stay={{ reference: current.reference, label: room, free: true }}
        defaultPhone={phone}
        checkoutPath="/food"
      />
    </PageContainer>
  );
}

const MEAL_ORDER = [/breakfast|petit|ifunguro/i, /starter|entr|soup|soupe/i, /lunch|déjeuner|saa sita/i, /dinner|dîner|ijoro/i, /main|plat/i, /grill|fish|poisson|meat|viande/i, /side|accomp/i, /dessert|sweet/i, /drink|boisson|ibinyobwa/i];

/** The menu to read (ordering opens during the guest's stay): dishes grouped by section. */
async function MenuList({ dishes }: { dishes: Dish[] }) {
  const [t, locale] = await Promise.all([getTranslations("Food"), getLocale()]);
  const sections = new Map<string, Dish[]>();
  for (const dish of dishes) sections.set(dish.section || t("dishes"), [...(sections.get(dish.section || t("dishes")) ?? []), dish]);
  // Meal order: breakfast first, drinks and desserts last; other sections in between.
  const rank = (name: string) => MEAL_ORDER.findIndex((re) => re.test(name));
  const ordered = [...sections].sort(([a], [b]) => (rank(a) < 0 ? 5 : rank(a)) - (rank(b) < 0 ? 5 : rank(b)));
  return (
    <div className="flex flex-col gap-8">
      {ordered.map(([name, list]) => (
        <section key={name}>
          <h2 className="mb-3 text-[19px] font-bold tracking-[-0.01em] text-ink">{name}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {list.map((dish) => (
              <li key={dish.id} className="flex gap-3 rounded-2xl bg-surface p-3 ring-1 ring-line">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-semibold text-ink">{dish.name}</span>
                  {dish.description && <span className="mt-0.5 line-clamp-2 text-[13px] text-muted">{dish.description}</span>}
                  <span className="mt-auto pt-2 text-[15px] font-semibold text-ink tabular-nums">{formatRWF(dish.price, locale)}</span>
                </span>
                {dish.photoUrl && (
                  <span className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-primary-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element -- menu photo from the kitchen's Cloudinary upload */}
                    <img src={dish.photoUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
