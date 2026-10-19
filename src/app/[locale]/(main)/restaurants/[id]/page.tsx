import { ChevronLeft, Clock, MapPin, Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/PageContainer";
import { MenuCart } from "@/features/food/components/MenuCart";
import { distanceKm } from "@/features/food/rules";
import { publicRestaurant } from "@/features/food/service";
import { myStay } from "@/features/stay/service";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const r = await publicRestaurant((await params).id);
  return { title: r?.name ?? "" };
}

export default async function RestaurantPage({ params }: Props) {
  const r = await publicRestaurant((await params).id);
  if (!r) notFound();
  const [t, user] = await Promise.all([getTranslations("Food"), getCurrentUser()]);
  const stayNow = user ? await myStay(user.id) : null;
  const current = stayNow?.current ?? null;
  const paid = Boolean(current && stayNow && (current.status === "CONFIRMED" || current.status === "CHECKED_IN") && current.checkIn <= stayNow.today);
  // Room orders: the restaurant at the guest's place, or one that delivers that far.
  const atPlace = Boolean(paid && current && r.listingId === current.listing.id);
  const reaches = Boolean(paid && current && (atPlace || (r.delivery && distanceKm(r, current.listing) <= r.deliveryKm)));
  const phone = user ? (await db.user.findUnique({ where: { id: user.id }, select: { phone: true } }))?.phone ?? null : null;

  return (
    <PageContainer className="max-w-5xl py-6 md:py-10">
      <Link href="/restaurants" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("restaurantsTitle")}
      </Link>
      <h1 className="text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink md:text-[32px] md:leading-10">{r.name}</h1>
      {r.description && <p className="mt-1 max-w-2xl text-[15px] text-muted">{r.description}</p>}
      <div className="mt-3 mb-6 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-ink">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-4 text-primary" aria-hidden="true" />
          {r.addressLine}, {r.district}, {r.city}
        </span>
        {r.openingHours && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4 text-primary" aria-hidden="true" />
            {r.openingHours}
          </span>
        )}
        {r.phone && (
          <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1.5 text-primary">
            <Phone className="size-4" aria-hidden="true" />
            {r.phone}
          </a>
        )}
      </div>
      {r.menu.length === 0 ? (
        <p className="text-[15px] text-muted">{t("menuSoon")}</p>
      ) : (
        <MenuCart
          restaurant={{ id: r.id, pickup: r.pickup, delivery: r.delivery, deliveryFee: r.deliveryFee, paused: r.paused, atYourStay: atPlace }}
          menu={r.menu}
          signedIn={user !== null}
          stay={reaches && current ? { reference: current.reference, label: [current.listing.title, current.room?.name].filter(Boolean).join(" · "), free: atPlace } : null}
          defaultPhone={phone}
        />
      )}
    </PageContainer>
  );
}
