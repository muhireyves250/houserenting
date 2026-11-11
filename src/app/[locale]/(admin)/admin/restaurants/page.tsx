import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { FilterTabs, PageIntro, Panel, Table, td } from "@/features/admin/components/ui";
import { allRestaurants } from "@/features/food/service";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/permissions";

const STATUSES = ["DRAFT", "PUBLISHED", "HIDDEN"] as const;
type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminRestaurantsPage({ searchParams }: Props) {
  await requireAdmin("/admin/restaurants");
  const raw = (await searchParams).status;
  const status = STATUSES.find((s) => s === raw);
  const [t, tFood, list] = await Promise.all([getTranslations("Admin"), getTranslations("Food"), allRestaurants(status)]);
  return (
    <div>
      <PageIntro
        description={tFood("adminIntro")}
        actions={
          <Link href="/admin/restaurants/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover">
            <Plus className="size-4" aria-hidden="true" />
            {tFood("addRestaurant")}
          </Link>
        }
      />
      <div className="mb-4">
        <FilterTabs
          items={[
            { label: t("all"), href: { pathname: "/admin/restaurants", query: {} }, on: !status },
            ...STATUSES.map((s) => ({ label: tFood(`restaurantStatus.${s}`), href: { pathname: "/admin/restaurants", query: { status: s } }, on: status === s })),
          ]}
        />
      </div>
      <Panel flush>
        <Table head={[tFood("name"), t("host"), tFood("city"), tFood("menuTitle"), tFood("ordersTitle"), t("col.status")]} empty={list.length === 0 ? <p className="py-8 text-center text-[14px] text-muted">{t("nothingHere")}</p> : null}>
          {list.map((r) => (
            <tr key={r.id} className="hover:bg-canvas/70">
              <td className={td}>
                <Link href={`/admin/restaurants/${r.id}`} className="font-semibold text-primary hover:underline">
                  {r.name}
                </Link>
              </td>
              <td className={td}>{r.owner.name}</td>
              <td className={td}>{r.city}</td>
              <td className={td}>{r._count.menu}</td>
              <td className={td}>{r._count.orders}</td>
              <td className={td}>
                {tFood(`restaurantStatus.${r.status}`)}
                {r.paused && ` · ${tFood("closedNow")}`}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
