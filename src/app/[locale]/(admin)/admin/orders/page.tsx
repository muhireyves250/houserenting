import { getLocale, getTranslations } from "next-intl/server";
import { PageIntro, Panel } from "@/features/admin/components/ui";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { ConfirmOrderPayment } from "@/features/food/components/ConfirmOrderPayment";
import { OrdersBoard, type BoardOrder } from "@/features/food/components/OrdersBoard";
import { nextOrderSteps } from "@/features/food/rules";
import { allOrders, ordersAwaitingPayment } from "@/features/food/service";
import { formatRWF } from "@/lib/format";
import { requireAdmin } from "@/lib/permissions";

/**
 * Staff run every guest's food order to the end: confirm the payment, then accept, prepare, mark ready and
 * delivered (or cancel with a reason). Kitchens see the same steps on their own page.
 */
export default async function AdminOrdersPage() {
  await requireAdmin("/admin/orders");
  const [t, locale, awaiting, orders] = await Promise.all([getTranslations("Food"), getLocale(), ordersAwaitingPayment(), allOrders()]);
  const board: BoardOrder[] = orders
    // Unpaid pay-first orders wait in the payments panel above.
    .filter((o) => !(o.paymentMethod === "PAY_FIRST" && o.total > 0 && !o.paidAt && o.status === "PLACED"))
    .map((o) => ({
      reference: o.reference,
      status: o.status,
      fulfilment: o.fulfilment,
      customer: o.customer.name,
      phone: o.phone,
      address: [o.restaurant.name, o.address].filter(Boolean).join(" → "),
      note: o.note,
      total: o.total,
      createdAt: o.createdAt,
      items: o.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      steps: [...new Set((["kitchen", "courier"] as const).flatMap((a) => nextOrderSteps(o.status, o.fulfilment, a)))],
    }));
  const open = board.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED");
  const done = board.filter((o) => !open.includes(o)).slice(0, 30);

  return (
    <div className="flex flex-col gap-5">
      <PageIntro description={t("staffOrders.intro")} />
      <Panel title={t("staffPay.title")}>
        <p className="-mt-1 mb-3 text-[13px] text-muted">{t("staffPay.intro")}</p>
        {awaiting.length === 0 ? (
          <p className="py-4 text-center text-[14px] text-muted">{t("staffPay.empty")}</p>
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
                    {o.paymentClaim ? t("staffPay.claimed", { reference: o.paymentClaim }) : t("staffPay.notClaimed")}
                  </p>
                </div>
                <ConfirmOrderPayment reference={o.reference} claimed={o.paymentClaim} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={t("staffOrders.open")}>
        {open.length === 0 ? <p className="py-4 text-center text-[14px] text-muted">{t("staffOrders.noOpen")}</p> : <OrdersBoard orders={open} />}
      </Panel>
      {done.length > 0 && (
        <Panel title={t("staffOrders.done")}>
          <OrdersBoard orders={done} />
        </Panel>
      )}
    </div>
  );
}
