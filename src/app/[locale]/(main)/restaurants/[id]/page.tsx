import { Bike, ChevronLeft, Clock, MapPin, Phone, ShoppingBag, Store, UtensilsCrossed } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { MenuCart } from "@/features/food/components/MenuCart";
import { distanceKm } from "@/features/food/rules";
import { publicRestaurant } from "@/features/food/service";
import { myStay } from "@/features/stay/service";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { formatRWF } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const r = await publicRestaurant((await params).id);
  return { title: r?.name ?? "" };
}

/** A restaurant: who they are and how they serve at a glance, then the menu and the order. */
export default async function RestaurantPage({ params }: Props) {
  const r = await publicRestaurant((await params).id);
  if (!r) notFound();
  const [t, locale, user] = await Promise.all([getTranslations("Food"), getLocale(), getCurrentUser()]);
  const stayNow = user ? await myStay(user.id) : null;
  const current = stayNow?.current ?? null;
  const paid = Boolean(current && stayNow && (current.status === "CONFIRMED" || current.status === "CHECKED_IN") && current.checkIn <= stayNow.today);
  // Room orders: the restaurant at the guest's place, or one that delivers that far.
  const atPlace = Boolean(paid && current && r.listingId === current.listing.id);
  const reaches = Boolean(paid && current && (atPlace || (r.delivery && distanceKm(r, current.listing) <= r.deliveryKm)));
  const phone = user ? ((await db.user.findUnique({ where: { id: user.id }, select: { phone: true } }))?.phone ?? null) : null;

  const facts = [
    { icon: Clock, text: t("readyIn", { minutes: r.prepMinutes }) },
    ...(r.delivery ? [{ icon: Bike, text: t("deliveryFact", { fee: formatRWF(r.deliveryFee, locale), km: r.deliveryKm }) }] : []),
    ...(r.pickup ? [{ icon: Store, text: t("fulfilment.PICKUP") }] : []),
    ...(r.minOrder > 0 ? [{ icon: ShoppingBag, text: t("minOrderFact", { amount: formatRWF(r.minOrder, locale) }) }] : []),
  ];

  return (
    <>
      {/* Cover */}
      <div className="relative h-44 overflow-hidden bg-primary md:h-64">
        {r.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- restaurant cover from Cloudinary or a demo image
          <img src={r.photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <UtensilsCrossed className="absolute top-1/2 left-1/2 size-14 -translate-x-1/2 -translate-y-1/2 text-white/40" aria-hidden="true" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <PageContainer className="relative flex h-full max-w-6xl items-start pt-4">
          <Link href="/restaurants" className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-ink shadow-sm backdrop-blur hover:bg-white">
            <ChevronLeft className="size-4" aria-hidden="true" />
            {t("restaurantsTitle")}
          </Link>
        </PageContainer>
      </div>

      <PageContainer className="max-w-6xl pb-10">
        <div className="relative -mt-10 mb-6 rounded-3xl bg-surface p-5 shadow-[0_14px_40px_-18px_rgba(16,24,40,0.45)] ring-1 ring-black/[0.04] md:-mt-14 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[34px] md:leading-10">{r.name}</h1>
              {r.description && <p className="mt-1 max-w-2xl text-[15px] text-muted">{r.description}</p>}
            </div>
            <span className={r.paused ? "rounded-full bg-amber-100 px-3 py-1 text-[13px] font-semibold text-amber-900" : "rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-semibold text-emerald-800"}>
              {r.paused ? t("closedNow") : t("takingOrders")}
            </span>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {facts.map(({ icon: Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-[13px] font-medium text-ink">
                <Icon className="size-4 text-primary" aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-4 text-[14px] text-ink">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 text-muted" aria-hidden="true" />
              {r.addressLine}, {r.district}, {r.city}
            </span>
            {r.openingHours && (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4 text-muted" aria-hidden="true" />
                {r.openingHours}
              </span>
            )}
            {r.phone && (
              <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-primary">
                <Phone className="size-4" aria-hidden="true" />
                {r.phone}
              </a>
            )}
            {user && (
              <Link href="/orders" className="inline-flex items-center gap-1.5 font-semibold text-primary">
                <ShoppingBag className="size-4" aria-hidden="true" />
                {t("ordersTitle")}
              </Link>
            )}
          </div>
        </div>

        {r.menu.length === 0 ? (
          <p className="text-[15px] text-muted">{t("menuSoon")}</p>
        ) : (
          <MenuCart
            restaurant={{ id: r.id, pickup: r.pickup, delivery: r.delivery, deliveryFee: r.deliveryFee, paused: r.paused, atYourStay: atPlace, prepMinutes: r.prepMinutes, minOrder: r.minOrder }}
            menu={r.menu}
            signedIn={user !== null}
            stay={reaches && current ? { reference: current.reference, label: [current.listing.title, current.room?.name].filter(Boolean).join(" · "), free: atPlace } : null}
            defaultPhone={phone}
          />
        )}
      </PageContainer>
    </>
  );
}
