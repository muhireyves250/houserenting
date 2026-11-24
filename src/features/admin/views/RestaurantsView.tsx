import type { ReactNode } from "react";
import { Plus, Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ActionsMenu } from "@/features/admin/components/ActionsMenu";
import { adminCard, Chip, FillScreen, ScrollArea, StatTiles, Toolbar } from "@/features/admin/components/kit";
import { deleteRestaurantAction, setRestaurantPausedAction, setRestaurantStatusAction } from "@/features/food/actions";
import { allRestaurants } from "@/features/food/service";
import { Link } from "@/i18n/navigation";

const STATUSES = ["DRAFT", "PUBLISHED", "HIDDEN"] as const;
const TONE = { DRAFT: "bg-canvas text-ink", PUBLISHED: "bg-emerald-100 text-emerald-800", HIDDEN: "bg-amber-100 text-amber-900" } as const;
type Props = { searchParams: Promise<{ status?: string }> };

/** Staff run every restaurant from here: edit, publish or hide, open or close for orders, delete. */
export async function RestaurantsView({ searchParams, tabs }: { searchParams: Props["searchParams"]; tabs?: ReactNode }) {
  const raw = (await searchParams).status;
  const status = STATUSES.find((s) => s === raw);
  const [t, tFood, all] = await Promise.all([getTranslations("Admin"), getTranslations("Food"), allRestaurants()]);
  const list = status ? all.filter((r) => r.status === status) : all;
  return (
    <FillScreen>
      {tabs}
      {/* Counters and Add a restaurant on one row; the cards scroll below. */}
      <Toolbar actions={
        <Link href="/admin/restaurants/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover">
          <Plus className="size-4" aria-hidden="true" />
          {tFood("addRestaurant")}
        </Link>
      }>
        <StatTiles
          items={[
            { label: t("all"), count: all.length, href: { pathname: "/admin/orders", query: { tab: "restaurants" } }, on: !status },
            ...STATUSES.map((s) => ({ label: tFood(`restaurantStatus.${s}`), count: all.filter((r) => r.status === s).length, href: { pathname: "/admin/orders", query: { tab: "restaurants", status: s } }, on: status === s, tone: s === "PUBLISHED" ? "text-emerald-700" : "text-ink" })),
          ]}
        />
      </Toolbar>
      <ScrollArea>
      {list.length === 0 ? (
        <p className="rounded-2xl bg-surface py-10 text-center text-[14px] text-muted ring-1 ring-line">{t("nothingHere")}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {list.map((r) => (
            <li key={r.id} className={adminCard}>
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Store className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <Link href={`/admin/restaurants/${r.id}`} className="block truncate text-[16px] font-bold text-ink hover:text-primary">
                    {r.name}
                  </Link>
                  <span className="block truncate text-[13px] text-muted">
                    {r.city} · {r.owner.name}
                  </span>
                  {/* Its owner applied to cook for places: waiting for an answer on its page. */}
                  {r._count.placeRequests > 0 && (
                    <Link href={`/admin/restaurants/${r.id}`} className="mt-1 inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[12px] font-semibold text-amber-900 hover:bg-amber-200">
                      {tFood("placeKitchens.applications", { count: r._count.placeRequests })}
                    </Link>
                  )}
                </span>
                <Chip tone={TONE[r.status]}>{tFood(`restaurantStatus.${r.status}`)}</Chip>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip>{tFood("dishCount", { count: r._count.menu })}</Chip>
                <Chip>{tFood("adminList.orders", { count: r._count.orders })}</Chip>
                {r.paused && <Chip tone="bg-amber-100 text-amber-900">{tFood("closedNow")}</Chip>}
              </div>
              <div className="flex flex-wrap items-start gap-2 border-t border-line pt-3">
                {/* One Actions button: open and edit, publish or hide, open or close for orders, delete (no orders). */}
                <ActionsMenu
                  align="left"
                  items={[
                    { kind: "link", label: tFood("adminList.edit"), href: `/admin/restaurants/${r.id}` },
                    ...(r.status !== "PUBLISHED" ? [{ kind: "run" as const, label: tFood("rowActions.publish"), action: setRestaurantStatusAction.bind(null, r.id, "PUBLISHED"), errors: {} }] : []),
                    ...(r.status === "PUBLISHED" ? [{ kind: "run" as const, label: tFood("rowActions.hide"), action: setRestaurantStatusAction.bind(null, r.id, "HIDDEN"), reason: true, danger: true }] : []),
                    ...(r.status === "PUBLISHED" ? [{ kind: "run" as const, label: r.paused ? tFood("rowActions.open") : tFood("rowActions.close"), action: setRestaurantPausedAction.bind(null, r.id, !r.paused) }] : []),
                    ...(r._count.orders === 0 ? [{ kind: "run" as const, label: tFood("adminList.delete"), action: deleteRestaurantAction.bind(null, r.id), confirm: tFood("adminList.deleteQuestion"), danger: true, errors: { hasOrders: tFood("adminList.hasOrders") } }] : []),
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      </ScrollArea>
    </FillScreen>
  );
}
