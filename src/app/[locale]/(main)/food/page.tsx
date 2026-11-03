import { BedDouble, Clock, KeyRound, UtensilsCrossed } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageContainer } from "@/components/ui/PageContainer";
import { MenuCart } from "@/features/food/components/MenuCart";
import { kitchenForPlace } from "@/features/food/service";
import { myStay } from "@/features/stay/service";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getTranslations("Food");
  return { title: t("foodTitle") };
}

/**
 * FOOD: the menu of the place the guest is staying at. The kitchen there cooks it and brings it to their room;
 * guests never choose a restaurant.
 */
export default async function FoodPage() {
  const user = await requireUser("/food");
  const [t, { current, today }] = await Promise.all([getTranslations("Food"), myStay(user.id)]);
  const paid = current && (current.status === "CONFIRMED" || current.status === "CHECKED_IN");
  const started = Boolean(paid && current && current.checkIn <= today);
  const kitchen = current ? await kitchenForPlace(current.listing.id) : null;

  const title = <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{t("foodTitle")}</h1>;

  // No stay, not paid yet, not started yet, or no kitchen at the place: say why, and what to do.
  if (!current || !paid || !started || !kitchen || kitchen.menu.length === 0) {
    const reason = !current ? "noStay" : !paid ? "unpaid" : !started ? "notStarted" : "noKitchen";
    return (
      <PageContainer className="max-w-2xl pt-5 pb-10 md:py-10">
        {title}
        <div className="mt-6">
          <EmptyState
            icon={reason === "noKitchen" ? <UtensilsCrossed /> : <KeyRound />}
            title={t(`foodUnavailable.${reason}.title`)}
            body={t(`foodUnavailable.${reason}.body`, { place: current?.listing.title ?? "", day: current?.checkIn ?? "" })}
            action={
              <Link href={reason === "noStay" ? "/" : "/my-stay"} className="inline-flex items-center rounded-xl bg-primary px-7 py-3 text-[15px] font-semibold text-white">
                {reason === "noStay" ? t("findPlace") : t("openMyStay")}
              </Link>
            }
          />
        </div>
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
