import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Facts, PageIntro, Panel, Table, td } from "@/features/admin/components/ui";
import { recentAudit } from "@/features/audit/service";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { MenuEditor } from "@/features/food/components/MenuEditor";
import { RestaurantStatusActions } from "@/features/food/components/RestaurantControls";
import { RestaurantForm } from "@/features/food/components/RestaurantForm";
import { RestaurantTeam } from "@/features/food/components/RestaurantTeam";
import { restaurantForTeam, restaurantOrders } from "@/features/food/service";
import { Link } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { dynamicMessage } from "@/lib/dynamic-message";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";

type Props = { params: Promise<{ id: string }> };

export default async function AdminRestaurantPage({ params }: Props) {
  const { id } = await params;
  await requireAdmin(`/admin/restaurants/${id}`);
  const r = await restaurantForTeam(id);
  if (!r) notFound();
  const [t, tFood, locale, orders, places, history] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("Food"),
    getLocale(),
    restaurantOrders(id, 30),
    db.listing.findMany({ where: { hostId: r.ownerId, status: { not: "ARCHIVED" } }, select: { id: true, title: true } }),
    recentAudit({ entityType: "restaurant", entityId: id, take: 20 }),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <PageIntro back={{ href: "/admin/restaurants", label: tFood("restaurantsTitle") }} />
      <h2 className="text-[22px] leading-7 font-bold text-ink">{r.name}</h2>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <Panel title={tFood("ordersTitle")} flush>
            <Table head={[t("col.reference"), t("col.guest"), t("col.total"), t("col.status")]} empty={orders.length === 0 ? <p className="py-8 text-center text-[14px] text-muted">{t("nothingHere")}</p> : null}>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className={`${td} font-mono text-[13px]`}>{o.reference}</td>
                  <td className={td}>{o.customer.name}</td>
                  <td className={`${td} tabular-nums`}>{formatRWF(o.total, locale)}</td>
                  <td className={td}>{tFood(`status.${o.status}`)}</td>
                </tr>
              ))}
            </Table>
          </Panel>
          <Panel title={tFood("menuTitle")}>
            <MenuEditor restaurantId={r.id} items={r.menu} />
          </Panel>
          <RestaurantForm
            restaurantId={r.id}
            places={places}
            after="/admin/restaurants"
            initial={{
              name: r.name,
              description: r.description,
              phone: r.phone,
              addressLine: r.addressLine,
              district: r.district,
              city: r.city,
              lat: r.lat,
              lng: r.lng,
              openingHours: r.openingHours,
              photoUrl: r.photoUrl,
              pickup: r.pickup,
              delivery: r.delivery,
              deliveryFee: r.deliveryFee,
              deliveryKm: r.deliveryKm,
              listingId: r.listingId,
            }}
          />
        </div>
        <div className="flex flex-col gap-5">
          <Panel title={tFood("visibility")}>
            <p className="mb-3 text-[14px] text-ink">
              {tFood(`restaurantStatus.${r.status}`)}
              {r.statusReason && <span className="block text-[13px] text-muted">{r.statusReason}</span>}
            </p>
            <RestaurantStatusActions restaurantId={r.id} status={r.status} />
          </Panel>
          <Panel title={t("host")}>
            <Facts
              rows={[
                { label: t("col.name"), value: <Link href={`/admin/users/${r.owner.id}`} className="text-primary hover:underline">{r.owner.name}</Link> },
                { label: t("col.email"), value: <span className="break-all">{r.owner.email}</span> },
              ]}
            />
          </Panel>
          <Panel title={tFood("teamTitle")}>
            <RestaurantTeam restaurantId={r.id} members={r.team} />
          </Panel>
          <Panel title={t("history")}>
            <ol className="flex flex-col gap-2 text-[13px]">
              {history.map((e) => (
                <li key={e.id}>
                  <b className="font-semibold">{dynamicMessage(t, `action.${e.action}`, e.action)}</b> · {e.actor?.name ?? t("system")}
                  <span className="block text-muted">{formatKigaliDateTime(locale, e.createdAt)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}
