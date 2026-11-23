import { Bike, BookOpen, Download, FileText, Home, Users, Wallet, ChevronLeft, ClipboardList, Star, Store, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AutoRefresh } from "@/features/food/components/AutoRefresh";
import { MenuEditor } from "@/features/food/components/MenuEditor";
import { OrdersBoard, type BoardOrder } from "@/features/food/components/OrdersBoard";
import { PauseToggle } from "@/features/food/components/RestaurantControls";
import { RestaurantForm } from "@/features/food/components/RestaurantForm";
import { DeliveryPeople } from "@/features/food/components/DeliveryPeople";
import { CookForPlaces } from "@/features/food/components/CookForPlaces";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { ACTIVE_ORDER, acceptDeadline, nextOrderSteps, type OrderActor } from "@/features/food/rules";
import { canAddRestaurant, canRestaurant, confirmationsOf, restaurantsRunBy, restaurantForTeam, restaurantOrders, placesToApply, restaurantMoney, restaurantPlaces, restaurantReviews, restaurantRole, withDesk, withStayLocation } from "@/features/food/service";
import { Card } from "@/features/hosting/components/fields";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };
type Tab = "orders" | "money" | "menu" | "reviews" | "delivery" | "places" | "details";

/**
 * A restaurant's dashboard, kept simple: a header (live or not, open or closed), then tabs. Orders come first, grouped
 * by what to do next; then the menu, the guests' reviews, the delivery people and (for the owner) the details.
 */
export default async function HostRestaurantPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab: asked } = await searchParams;
  const user = await requireUser(`/host/restaurants/${id}`);
  const role = await restaurantRole(user, id);
  if (!role) notFound();
  const r = await restaurantForTeam(id);
  if (!r) notFound();
  const [t, locale, orders, reviews, cooking, money] = await Promise.all([
    getTranslations("Food"),
    getLocale(),
    restaurantOrders(id).then(withDesk).then(withStayLocation),
    canRestaurant(role, "reviews") ? restaurantReviews(id) : null,
    role === "owner" || role === "staff" ? Promise.all([restaurantPlaces(id), placesToApply(id)]).then(([p, options]) => ({ ...p, options })) : null,
    canRestaurant(role, "money") ? restaurantMoney(id) : null,
  ]);
  const manyRestaurants = role === "staff" || (await canAddRestaurant(user)) || (await restaurantsRunBy(user.id)).length > 1;
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
        confirmations: confirmationsOf(o, o.hasDesk),
        location: o.location,
        // The delivery person who took it says they handed it over (the kitchen can't mark it delivered).
        canConfirm: o.status === "OUT_FOR_DELIVERY" && o.courierId === user.id && !o.courierConfirmedAt,
        steps: [...new Set(actors.flatMap((a) => nextOrderSteps(o.status, o.fulfilment, a, paid)))],
      };
    });
  const open = board.filter((o) => ACTIVE_ORDER.includes(o.status));
  const fresh = open.filter((o) => o.status === "PLACED");
  const working = open.filter((o) => o.status !== "PLACED");
  const done = board.filter((o) => !open.includes(o)).slice(0, 20);

  // The tabs this person has (a delivery person only sees their orders).
  const tabs: { key: Tab; icon: LucideIcon; label: string; badge?: string | number }[] = [
    { key: "orders", icon: ClipboardList, label: kitchen ? t("dash.orders") : t("dash.myDeliveries"), badge: open.length || undefined },
    // The owner and managers: what orders brought in, a report for each day and every order's receipt.
    ...(money ? [{ key: "money" as const, icon: Wallet, label: t("money.tab") }] : []),
    ...(canRestaurant(role, "menu") ? [{ key: "menu" as const, icon: BookOpen, label: t("dash.menu"), badge: r.menu.length }] : []),
    ...(canRestaurant(role, "reviews") ? [{ key: "reviews" as const, icon: Star, label: t("dash.reviews"), badge: reviews && reviews.average !== null ? `${reviews.average.toFixed(1)}★` : undefined }] : []),
    // The owner: everyone working here (managers and delivery people); a manager: the delivery people.
    ...(canRestaurant(role, "delivery") ? [{ key: "delivery" as const, icon: canRestaurant(role, "team") ? Users : Bike, label: canRestaurant(role, "team") ? t("dash.team") : t("dash.delivery"), badge: canRestaurant(role, "team") ? r.team.length : couriers.length }] : []),
    // The owner: the places it cooks for, and applying for more.
    ...(cooking ? [{ key: "places" as const, icon: Home, label: t("dash.places"), badge: cooking.serving.length }] : []),
    ...(canRestaurant(role, "edit") ? [{ key: "details" as const, icon: Store, label: t("dash.details") }] : []),
  ];
  const rwf = (n: number) => formatRWF(n, locale);
  const dayLabel = (day: string) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
  const tab: Tab = tabs.some((x) => x.key === asked) ? (asked as Tab) : "orders";
  const section = (title: string, hint: string, list: BoardOrder[], tone: string) =>
    list.length > 0 && (
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("size-2.5 rounded-full", tone)} aria-hidden="true" />
          <h3 className="text-[16px] font-bold text-ink">
            {title} <span className="font-semibold text-muted">({list.length})</span>
          </h3>
        </div>
        <p className="-mt-2 text-[13px] text-muted">{hint}</p>
        <OrdersBoard orders={list} />
      </section>
    );

  return (
    <div className="flex flex-col gap-5">
      {/* New orders show up without reloading. */}
      <AutoRefresh seconds={20} />

      {/* Header: the restaurant, live or not, and open or closed for orders. */}
      <div className="flex flex-col gap-4 rounded-3xl bg-surface p-5 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
            {r.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- restaurant photo
              <img src={r.photoUrl} alt="" className="size-full object-cover" />
            ) : (
              <UtensilsCrossed className="size-6" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0">
            {/* Back to the list only for those with several restaurants (or who can add one). */}
            {manyRestaurants && (
              <Link href="/host/restaurants" className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
                <ChevronLeft className="size-3.5" aria-hidden="true" />
                {t("yourRestaurants")}
              </Link>
            )}
            <span className="block truncate text-[22px] leading-7 font-bold tracking-[-0.02em] text-ink">{r.name}</span>
            <span className={cn("mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold", r.status === "PUBLISHED" ? "bg-emerald-50 text-emerald-800" : r.status === "DRAFT" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-800")}>
              {t(`restaurantStatus.${r.status}`)}
            </span>
          </span>
        </div>
        {canRestaurant(role, "pause") && <PauseToggle restaurantId={r.id} paused={r.paused} />}
      </div>
      {r.status === "DRAFT" && <p className="rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-900">{t("draftNote")}</p>}
      {r.status === "HIDDEN" && r.statusReason && <p className="rounded-2xl bg-red-50 px-5 py-3 text-sm text-red-900">{t("hiddenNote", { reason: r.statusReason })}</p>}

      {/* Tabs: big, with an icon and a number. */}
      {tabs.length > 1 && (
        <nav aria-label={t("dash.sections")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map(({ key, icon: Icon, label, badge }) => {
            const on = key === tab;
            return (
              <Link
                key={key}
                href={{ pathname: `/host/restaurants/${r.id}`, query: key === "orders" ? {} : { tab: key } }}
                aria-current={on ? "page" : undefined}
                className={cn("inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl px-4 text-[15px] font-semibold transition-colors", on ? "bg-primary text-white shadow-[0_8px_18px_-10px_rgba(0,87,184,0.9)]" : "bg-surface text-ink ring-1 ring-line hover:ring-primary/40")}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
                {badge !== undefined && <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", on ? "bg-white/25" : "bg-canvas text-muted")}>{badge}</span>}
              </Link>
            );
          })}
        </nav>
      )}

      {tab === "orders" && (
        <div className="flex flex-col gap-8">
          {open.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-surface py-14 text-center ring-1 ring-line">
              <ClipboardList className="size-9 text-line-strong" aria-hidden="true" />
              <p className="text-[16px] font-semibold text-ink">{t("dash.noOrders")}</p>
              <p className="max-w-sm text-[13px] text-muted">{t("dash.noOrdersHint")}</p>
            </div>
          )}
          {section(t("dash.new"), t("dash.newHint"), fresh, "bg-amber-500")}
          {section(kitchen ? t("dash.working") : t("dash.myWorking"), kitchen ? t("dash.workingHint") : t("dash.myWorkingHint"), working, "bg-primary")}
          {done.length > 0 && (
            <details className="group rounded-3xl bg-surface p-5 ring-1 ring-line">
              <summary className="cursor-pointer list-none text-[16px] font-bold text-ink">
                {t("dash.done")} <span className="font-semibold text-muted">({done.length})</span>
              </summary>
              <div className="mt-4">
                <OrdersBoard orders={done} />
              </div>
            </details>
          )}
        </div>
      )}

      {tab === "money" && money && (
        <div className="flex flex-col gap-5">
          {/* Today and this month: sales, VIIPA's commission, their share. */}
          <div className="grid gap-3 md:grid-cols-2">
            {([["today", money.today], ["thisMonth", money.month]] as const).map(([key, m]) => (
              <section key={key} className="flex flex-col gap-3 rounded-3xl bg-surface p-5 ring-1 ring-line">
                <span className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[16px] font-bold text-ink">{t(`money.${key}`)}</h3>
                  <span className="text-[13px] text-muted">{t("money.orders", { count: m.orders })}</span>
                </span>
                <span className="text-[30px] leading-9 font-bold text-emerald-700 tabular-nums">{rwf(m.share)}</span>
                <span className="-mt-2 text-[13px] text-muted">{t("money.share")}</span>
                <span className="grid grid-cols-2 gap-2 border-t border-line pt-3 text-[13px]">
                  <span>
                    <span className="block text-muted">{t("money.sales")}</span>
                    <b className="font-semibold text-ink tabular-nums">{rwf(m.sales)}</b>
                  </span>
                  <span>
                    <span className="block text-muted">{t("money.commission")}</span>
                    <b className="font-semibold text-ink tabular-nums">− {rwf(m.commission)}</b>
                  </span>
                </span>
              </section>
            ))}
          </div>
          <p className="text-[12px] text-muted">{t("money.payoutNote")}</p>

          {money.orders.length === 0 ? (
            <p className="rounded-3xl bg-surface py-12 text-center text-[14px] text-muted ring-1 ring-line">{t("money.noSales")}</p>
          ) : (
            <>
              {/* One line per day, with that day's report to download. */}
              <Card title={t("money.daily")}>
                <p className="-mt-2 mb-3 text-[13px] text-muted">{t("money.dailyHint")}</p>
                <ul className="flex flex-col divide-y divide-line">
                  {money.days.map((d) => (
                    <li key={d.day} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                      <span className="min-w-28 text-[15px] font-semibold text-ink">{dayLabel(d.day)}</span>
                      <span className="text-[13px] text-muted">{t("money.orders", { count: d.orders })}</span>
                      <span className="text-[13px] text-muted">
                        {t("money.sales")} <b className="text-ink tabular-nums">{rwf(d.sales)}</b>
                      </span>
                      <span className="text-[13px] text-muted">
                        {t("money.share")} <b className="text-emerald-700 tabular-nums">{rwf(d.share)}</b>
                      </span>
                      <a href={`/api/v1/restaurants/${r.id}/report?day=${d.day}&lang=${locale}`} className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary/10 px-4 text-[14px] font-semibold text-primary hover:bg-primary/15">
                        <Download className="size-4" aria-hidden="true" />
                        {t("money.download")}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Every paid order, with its receipt. */}
              <Card title={t("money.receipts")}>
                <p className="-mt-2 mb-3 text-[13px] text-muted">{t("money.receiptsHint")}</p>
                <ul className="flex flex-col divide-y divide-line">
                  {money.orders.map((o) => (
                    <li key={o.reference} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                      <span className="font-mono text-[14px] font-bold text-ink">{o.reference}</span>
                      <span className="text-[13px] text-muted">{formatKigaliDateTime(locale, o.paidAt)}</span>
                      <span className="text-[13px] text-muted">{o.customer}</span>
                      <span className="text-[14px] font-semibold text-ink tabular-nums">{rwf(o.total)}</span>
                      <a href={`/api/v1/restaurants/${r.id}/receipt/${o.reference}?lang=${locale}`} className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-[14px] font-semibold text-primary ring-1 ring-primary/30 hover:bg-primary/5">
                        <FileText className="size-4" aria-hidden="true" />
                        {t("money.receipt")}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === "menu" && (
        <Card title={t("menuTitle")}>
          <MenuEditor restaurantId={r.id} items={r.menu} />
        </Card>
      )}

      {tab === "reviews" && reviews && (
        <Card title={t("dash.reviews")}>
          {reviews.rows.length === 0 ? (
            <p className="py-8 text-center text-[14px] text-muted">{t("dash.noReviews")}</p>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="flex items-center gap-2 text-[15px] text-ink">
                <span className="text-[28px] font-bold">{reviews.average!.toFixed(1)}</span>
                <Stars value={Math.round(reviews.average!)} />
                <span className="text-muted">· {t("dash.reviewCount", { count: reviews.rows.length })}</span>
              </p>
              <ul className="grid gap-3 lg:grid-cols-2">
                {reviews.rows.map((v) => (
                  <li key={v.reference} className="flex flex-col gap-1.5 rounded-2xl bg-canvas p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Stars value={v.rating ?? 0} />
                      <span className="text-[12px] text-muted">{formatKigaliDateTime(locale, v.updatedAt)}</span>
                    </div>
                    {v.feedback && <p className="text-[14px] text-ink">“{v.feedback}”</p>}
                    <p className="text-[12px] text-muted">
                      {v.customer} · {v.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {tab === "delivery" && (
        <Card title={canRestaurant(role, "team") ? t("dash.team") : t("dash.delivery")}>
          <DeliveryPeople
            restaurantId={r.id}
            roles={canRestaurant(role, "team") ? ["MANAGER", "DELIVERY"] : ["DELIVERY"]}
            members={r.team
              .filter((m) => canRestaurant(role, "team") || m.role === "DELIVERY")
              .map((m) => ({ id: m.id, name: m.user.name, email: m.user.email, role: m.role === "DELIVERY" ? ("DELIVERY" as const) : ("MANAGER" as const) }))}
          />
        </Card>
      )}

      {tab === "places" && cooking && (
        <Card title={t("dash.places")}>
          <CookForPlaces restaurantId={r.id} serving={cooking.serving} requests={cooking.requests} options={cooking.options} />
        </Card>
      )}

      {tab === "details" && (
        <RestaurantForm
          restaurantId={r.id}
          after={`/host/restaurants/${r.id}`}
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
    </div>
  );
}

/** Stars out of 5. */
function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= value ? "fill-amber-400 text-amber-400" : "text-line-strong")} aria-hidden="true" />
      ))}
    </span>
  );
}
