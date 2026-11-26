import { PageHero } from "@/components/shell/PageHero";
import { ArrowRight, BedDouble, Clock, KeyRound, UtensilsCrossed } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { MenuCart } from "@/features/food/components/MenuCart";
import { foodMenu, kitchenForPlace } from "@/features/food/service";
import { listingPath } from "@/features/listings/links";
import { myStay } from "@/features/stay/service";
import { Link, redirect } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("Food");
  return { title: t("foodTitle") };
}

/**
 * FOOD: the menu of the place the guest is staying at. The kitchen there cooks it and brings it to their room;
 * guests never choose a restaurant. Anyone can read the menu; ordering opens once their paid stay has started.
 */
export default async function FoodPage({ searchParams }: { searchParams: Promise<{ place?: string | string[] }> }) {
  const user = await getCurrentUser();
  const asked = (await searchParams).place;
  const placeId = typeof asked === "string" ? asked : null;
  const [t, { current, today }] = await Promise.all([getTranslations("Food"), user ? myStay(user.id) : { current: null, today: "" }]);
  // Opened from a place's page (?place=): that place's menu, to read, unless the guest is staying there.
  if (placeId && current?.listing.id !== placeId) return placeMenu(placeId, Boolean(user), t);
  const paid = current && (current.status === "CONFIRMED" || current.status === "CHECKED_IN");
  const started = Boolean(paid && current && current.checkIn <= today);
  const kitchen = current ? await kitchenForPlace(current.listing.id) : null;

  const title = (
    <>
      <PageHero title={t("foodTitle")} icon={UtensilsCrossed} />
      <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink max-md:hidden md:text-[32px] md:leading-10">{t("foodTitle")}</h1>
    </>
  );

  // No stay, not paid yet, not started yet, or no kitchen at the place: say why and what to do, and still show the menu.
  if (!user || !current || !paid || !started || !kitchen || kitchen.menu.length === 0) {
    const reason = !current ? "noStay" : !paid ? "unpaid" : !started ? "notStarted" : "noKitchen";
    const menu = kitchen && kitchen.menu.length > 0 ? kitchen.menu : await foodMenu();
    return (
      <PageContainer className="pt-5 pb-10 max-md:pt-0 md:py-10">
        {title}
        <p className="mt-1 text-[14px] text-muted md:text-[15px] lg:hidden">{t("menuIntro")}</p>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface p-3 pr-4 ring-1 ring-line">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            {reason === "noKitchen" ? <UtensilsCrossed className="size-5" aria-hidden="true" /> : <KeyRound className="size-5" aria-hidden="true" />}
          </span>
          <span className="min-w-0 flex-1 text-[13px] leading-[18px]">
            <b className="block text-[14px] font-semibold text-ink">{t(`foodUnavailable.${reason}.title`)}</b>
            <span className="text-muted">{t(`foodUnavailable.${reason}.body`, { place: current?.listing.title ?? "", day: current?.checkIn ?? "" })}</span>
          </span>
          <Link
            href={reason === "noStay" ? "/" : "/my-stay"}
            aria-label={reason === "noStay" ? t("findPlace") : t("openMyStay")}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover sm:px-4"
          >
            <span className="max-sm:hidden">{reason === "noStay" ? t("findPlace") : t("openMyStay")}</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-4">
          <MenuCart
            restaurant={{ id: "menu", pickup: false, delivery: false, deliveryFee: 0, paused: true, atYourStay: true, prepMinutes: 0, minOrder: 0 }}
            menu={menu}
            signedIn={Boolean(user)}
            stay={null}
            defaultPhone={null}
            browseOnly
          />
        </div>
      </PageContainer>
    );
  }

  const phone = (await db.user.findUnique({ where: { id: user.id }, select: { phone: true } }))?.phone ?? null;
  const room = [current.listing.title, current.room?.name].filter(Boolean).join(" · ");

  // The same look as the menu without a stay: intro, one box saying where it goes, then the menu (with ordering).
  return (
    <PageContainer className="pt-5 pb-10 max-md:pt-0 md:py-10">
      {title}
      <p className="mt-1 text-[14px] text-muted md:text-[15px] lg:hidden">{t("menuIntro")}</p>
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface p-3 pr-4 ring-1 ring-line">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <BedDouble className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-[13px] leading-[18px]">
          <b className="block text-[14px] font-semibold text-ink">{t("deliveredTo", { place: room })}</b>
          <span className="inline-flex items-center gap-1 text-muted">
            <Clock className="size-3.5" aria-hidden="true" />
            {t("readyIn", { minutes: kitchen.prepMinutes })}
          </span>
        </span>
        {kitchen.paused && <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1.5 text-[12px] font-semibold text-amber-900">{t("kitchenClosed")}</span>}
      </div>
      <div className="mt-4">
        <MenuCart
          restaurant={{ id: kitchen.id, pickup: false, delivery: false, deliveryFee: 0, paused: kitchen.paused, atYourStay: true, prepMinutes: kitchen.prepMinutes, minOrder: kitchen.minOrder }}
          menu={kitchen.menu}
          signedIn
          stay={{ reference: current.reference, label: room, free: true }}
          defaultPhone={phone}
          checkoutPath="/food"
          single
        />
      </div>
    </PageContainer>
  );
}

/** A place's own menu, opened from its page: read it here, order once staying there. */
async function placeMenu(listingId: string, signedIn: boolean, t: Awaited<ReturnType<typeof getTranslations<"Food">>>) {
  const [listing, kitchen] = await Promise.all([
    db.listing.findFirst({ where: { id: listingId, status: "PUBLISHED" }, select: { id: true, title: true } }),
    kitchenForPlace(listingId),
  ]);
  if (!listing) return redirect({ href: "/food", locale: await getLocale() });
  return (
    <PageContainer className="pt-5 pb-10 max-md:pt-0 md:py-10">
      <PageHero title={t("foodTitle")} icon={UtensilsCrossed} />
      <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink max-md:hidden md:text-[32px] md:leading-10">{t("placeMenuTitle", { place: listing.title })}</h1>
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface p-3 pr-4 ring-1 ring-line">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <UtensilsCrossed className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 text-[13px] leading-[18px]">
          <b className="block text-[14px] font-semibold text-ink">{kitchen ? t("placeMenu.title", { place: listing.title }) : t("foodUnavailable.noKitchen.title")}</b>
          <span className="text-muted">{kitchen ? t("placeMenu.body") : t("foodUnavailable.noKitchen.body", { place: listing.title })}</span>
        </span>
        <Link
          href={listingPath(listing.id, listing.title)}
          aria-label={t("placeMenu.back")}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover sm:px-4"
        >
          <span className="max-sm:hidden">{t("placeMenu.back")}</span>
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {kitchen && (
        <div className="mt-4">
          <MenuCart
            restaurant={{ id: "menu", pickup: false, delivery: false, deliveryFee: 0, paused: true, atYourStay: true, prepMinutes: kitchen.prepMinutes, minOrder: 0 }}
            menu={kitchen.menu}
            signedIn={signedIn}
            stay={null}
            defaultPhone={null}
            browseOnly
          />
        </div>
      )}
    </PageContainer>
  );
}
