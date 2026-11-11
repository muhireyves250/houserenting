import { Plus } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { FilterTabs, PageIntro, Panel, Table, td } from "@/features/admin/components/ui";
import { allRestaurants, ordersAwaitingPayment } from "@/features/food/service";
import { ConfirmOrderPayment } from "@/features/food/components/ConfirmOrderPayment";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { formatRWF } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/permissions";

const STATUSES = ["DRAFT", "PUBLISHED", "HIDDEN"] as const;
type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminRestaurantsPage({ searchParams }: Props) {
  await requireAdmin("/admin/restaurants");
  const raw = (await searchParams).status;
  const status = STATUSES.find((s) => s === raw);
  const [t, tFood, list, awaiting, locale] = await Promise.all([getTranslations("Admin"), getTranslations("Food"), allRestaurants(status), ordersAwaitingPayment(), getLocale()]);
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
      {/* Pay-first food orders: confirm the money arrived so the kitchen can start. */}
      <div className="mb-5">
        <Panel title={tFood("staffPay.title")}>
          <p className="-mt-1 mb-3 text-[13px] text-muted">{tFood("staffPay.intro")}</p>
          {awaiting.length === 0 ? (
            <p className="py-4 text-center text-[14px] text-muted">{tFood("staffPay.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {awaiting.map((o) => (
                <li key={o.reference} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-ink">
                      <span className="font-mono">{o.reference}</span> · {formatRWF(o.total, locale)}
                    </p>
                    <p className="text-[13px] text-muted">
                      {o.customer.name} · {o.phone} · {o.address ?? o.restaurant.name} · {formatKigaliDateTime(locale, o.createdAt)}
                    </p>
                    <p className={o.paymentClaim ? "text-[13px] font-medium text-amber-800" : "text-[13px] text-muted"}>
                      {o.paymentClaim ? tFood("staffPay.claimed", { reference: o.paymentClaim }) : tFood("staffPay.notClaimed")}
                    </p>
                  </div>
                  <ConfirmOrderPayment reference={o.reference} claimed={o.paymentClaim} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
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
