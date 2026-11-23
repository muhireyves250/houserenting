import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AutoRefresh } from "@/features/food/components/AutoRefresh";
import { MenuEditor } from "@/features/food/components/MenuEditor";
import { OrdersBoard, type BoardOrder } from "@/features/food/components/OrdersBoard";
import { PauseToggle } from "@/features/food/components/RestaurantControls";
import { RestaurantForm } from "@/features/food/components/RestaurantForm";
import { RestaurantTeam } from "@/features/food/components/RestaurantTeam";
import { ACTIVE_ORDER, acceptDeadline, nextOrderSteps, type OrderActor } from "@/features/food/rules";
import { canRestaurant, restaurantForTeam, restaurantOrders, restaurantRole } from "@/features/food/service";
import { Card } from "@/features/hosting/components/fields";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

/** A restaurant's workspace: orders for everyone on the team; menu, details and team for those allowed. */
export default async function HostRestaurantPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/host/restaurants/${id}`);
  const role = await restaurantRole(user, id);
  if (!role) notFound();
  const r = await restaurantForTeam(id);
  if (!r) notFound();
  const [t, orders] = await Promise.all([getTranslations("Food"), restaurantOrders(id)]);
  const kitchen = canRestaurant(role, "orders");
  // The restaurant's delivery people (to assign ready orders), and who is on each order.
  const couriers = r.team.filter((m) => m.role === "DELIVERY").map((m) => ({ id: m.userId, name: m.user.name }));
  const courierName = (id: string | null) => (id ? (couriers.find((c) => c.id === id)?.name ?? null) : null);
  const actors: OrderActor[] = [...(kitchen ? (["kitchen"] as const) : []), ...(canRestaurant(role, "deliver") ? (["courier"] as const) : [])];
  const board: BoardOrder[] = orders
    // Delivery people see the orders given to them.
    .filter((o) => kitchen || o.courierId === user.id)
    .map((o) => {
      const paid = Boolean(o.paidAt) || o.total <= 0;
      return {
        reference: o.reference,
        status: o.status,
        fulfilment: o.fulfilment,
        customer: o.customer.name,
        phone: o.phone,
        address: o.address,
        note: o.note,
        total: o.total,
        createdAt: o.createdAt,
        items: o.items.map((i) => ({ name: i.name, quantity: i.quantity })),
        paid,
        deadline: o.status === "PLACED" ? acceptDeadline(o.createdAt) : null,
        courier: courierName(o.courierId),
        couriers: kitchen ? couriers : [],
        steps: [...new Set(actors.flatMap((a) => nextOrderSteps(o.status, o.fulfilment, a, paid)))],
      };
    });
  const open = board.filter((o) => ACTIVE_ORDER.includes(o.status));
  const done = board.filter((o) => !open.includes(o)).slice(0, 20);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/host/restaurants" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t("yourRestaurants")}
      </Link>
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h2 className="text-[22px] leading-7 font-bold tracking-[-0.03em] text-ink md:text-[24px] md:leading-8">{r.name}</h2>
        <span className="rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-ink">{t(`restaurantStatus.${r.status}`)}</span>
        {canRestaurant(role, "pause") && <PauseToggle restaurantId={r.id} paused={r.paused} />}
      </div>
      {r.status === "DRAFT" && <p className="mb-4 rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-900">{t("draftNote")}</p>}
      {r.status === "HIDDEN" && r.statusReason && <p className="mb-4 rounded-2xl bg-red-50 px-5 py-3 text-sm text-red-900">{t("hiddenNote", { reason: r.statusReason })}</p>}
      {/* New orders show up without reloading. */}
      <AutoRefresh seconds={20} />
      <div className="flex flex-col gap-4">
        <Card title={t("ordersOpen", { count: open.length })}>
          <OrdersBoard orders={open} />
        </Card>
        {canRestaurant(role, "menu") && (
          <Card title={t("menuTitle")}>
            <MenuEditor restaurantId={r.id} items={r.menu} />
          </Card>
        )}
        {(role === "owner" || role === "manager") && r.team.length > 0 && (
          // VIIPA sets who works here; the owner and managers see the team.
          <Card title={t("teamTitle")}>
            <RestaurantTeam restaurantId={r.id} members={r.team} readOnly />
          </Card>
        )}
        {canRestaurant(role, "edit") && (
          <RestaurantForm
            restaurantId={r.id}
            after="/host/restaurants"
            initial={{
              name: r.name,
              description: r.description,
              phone: r.phone,
              addressLine: r.addressLine,
              district: r.district,
              villageCode: r.villageCode ?? "",
              city: r.city,
              lat: r.lat,
              lng: r.lng,
              openingHours: r.openingHours,
              photoUrl: r.photoUrl,
              pickup: r.pickup,
              delivery: r.delivery,
              deliveryFee: r.deliveryFee,
              deliveryKm: r.deliveryKm,
              prepMinutes: r.prepMinutes,
              minOrder: r.minOrder,
              listingId: r.listingId,
            }}
          />
        )}
        {done.length > 0 && (
          <Card title={t("pastOrders")}>
            <OrdersBoard orders={done} />
          </Card>
        )}
      </div>
    </div>
  );
}
