import { BedDouble, Phone, Store } from "lucide-react";
import { FillScreen, ScrollArea, Toolbar } from "@/features/admin/components/kit";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { formatKigaliDateTime } from "@/features/bookings/format";
import { ConfirmOrderPayment } from "@/features/food/components/ConfirmOrderPayment";
import { OrdersBoard, type BoardOrder } from "@/features/food/components/OrdersBoard";
import { StaffDeclineOrder } from "@/features/food/components/StaffDeclineOrder";
import { ORDER_STATUSES, acceptDeadline, nextOrderSteps } from "@/features/food/rules";
import { FoodOrderList } from "@/features/places/components/PlaceServices";
import { foodHistories } from "@/features/places/services-history";
import { allOrders, confirmationsOf, ordersAwaitingPayment, withStayLocation } from "@/features/food/service";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";

/** One group of orders: a title with its count, then the orders (or a short "nothing"). */
function Group({ id, title, count, tone, children }: { id: string; title: string; count: number; tone: string; children: ReactNode }) {
  return (
    <section id={id} className="min-w-0 scroll-mt-24">
      <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold text-ink">
        {title}
        <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums", count > 0 ? tone : "bg-canvas text-muted")}>{count}</span>
      </h2>
      {children}
    </section>
  );
}

/**
 * Staff run every food order: to pay (confirm the payment, which confirms the order) → to send (get the food,
 * mark it sent) → sent (the guest confirms they got it). Finished ones are folded away.
 */
export async function FoodOrdersView({ tabs }: { tabs?: ReactNode }) {
  const [t, locale, awaiting, orders] = await Promise.all([getTranslations("Food"), getLocale(), ordersAwaitingPayment(), allOrders().then(withStayLocation)]);
  const board: BoardOrder[] = orders
    // Orders the restaurant confirmed that wait for payment are in "To pay".
    .filter((o) => !(o.total > 0 && !o.paidAt && o.status === "ACCEPTED"))
    .map((o) => ({
      reference: o.reference,
      status: o.status,
      fulfilment: o.fulfilment,
      customer: o.customer.name,
      phone: o.phone,
      address: o.address,
      kitchen: o.restaurant.name,
      paid: o.paidAt !== null,
      note: o.note,
      total: o.total,
      createdAt: o.createdAt,
      items: o.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      deadline: o.status === "PLACED" ? acceptDeadline(o.createdAt) : null,
      couriers: o.restaurant.team.filter((m) => m.role === "DELIVERY").map((m) => ({ id: m.userId, name: m.user.name })),
      courier: o.restaurant.team.find((m) => m.userId === o.courierId)?.user.name ?? null,
      // Who processes it at the restaurant (to call, or remind from here).
      kitchenPeople: [
        { name: o.restaurant.owner.name, phone: o.restaurant.owner.phone, role: "OWNER" as const },
        ...o.restaurant.team.filter((m) => m.role !== "DELIVERY").map((m) => ({ name: m.user.name, phone: m.user.phone, role: "MANAGER" as const })),
      ],
      canRemind: ["PLACED", "ACCEPTED", "PAID", "PREPARING", "READY"].includes(o.status),
      confirmations: confirmationsOf(o, o.hasDesk),
      location: o.location,
      steps: [...new Set((["kitchen", "courier"] as const).flatMap((a) => nextOrderSteps(o.status, o.fulfilment, a, Boolean(o.paidAt) || o.total <= 0)))],
    }));
  const toSend = board.filter((o) => ["PLACED", "ACCEPTED", "PAID", "PREPARING", "READY", "COURIER_ASSIGNED"].includes(o.status));
  const sent = board.filter((o) => o.status === "OUT_FOR_DELIVERY");
  const done = board.filter((o) => ["DELIVERED", "FINISHED", "REJECTED", "TIMED_OUT", "CANCELLED"].includes(o.status)).slice(0, 40);
  const finished = done.length ? await foodHistories({ reference: { in: done.map((o) => o.reference) } }, 40) : [];
  // The number of orders in each classification (requirements 3.6); "payment not confirmed" = the guest says they paid.
  const classes: { key: string; label: string; n: number }[] = [
    { key: "claim", label: t("staffOrders.paymentNotConfirmed"), n: orders.filter((o) => o.paymentClaim && !o.paidAt && o.status === "ACCEPTED").length },
    ...ORDER_STATUSES.map((st) => ({ key: st, label: t(`status.${st}`), n: orders.filter((o) => o.status === st).length })),
  ];
  const none = <p className="rounded-2xl bg-surface py-6 text-center text-[14px] text-muted ring-1 ring-line">{t("staffOrders.nothing")}</p>;

  return (
    <FillScreen>
      {tabs}
      <Toolbar>
        {/* Where things stand, at a glance. */}
        <nav className="grid grid-cols-3 gap-3">
          {(
            [
              ["to-pay", t("staffOrders.toPay"), awaiting.length, "text-amber-700"],
              ["to-send", t("staffOrders.toSend"), toSend.length, "text-primary"],
              ["sent", t("staffOrders.sent"), sent.length, "text-emerald-700"],
            ] as const
          ).map(([id, label, n, tone]) => (
            <a key={id} href={`#${id}`} className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line transition-colors hover:ring-primary">
              <span className={cn("block text-[26px] leading-8 font-bold tabular-nums", n > 0 ? tone : "text-muted")}>{n}</span>
              <span className="text-[13px] font-semibold text-ink">{label}</span>
            </a>
          ))}
        </nav>
        <div data-lenis-prevent className="filter-row mt-3 flex flex-wrap gap-1.5">
          {classes.map((c) => (
            <span key={c.key} className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", c.n > 0 ? "bg-primary/10 text-primary" : "bg-canvas text-muted")}>
              {c.label} <span className="tabular-nums">{c.n}</span>
            </span>
          ))}
        </div>
      </Toolbar>
      <ScrollArea className="flex flex-col gap-8">

      <Group id="to-pay" title={t("staffOrders.toPay")} count={awaiting.length} tone="bg-amber-100 text-amber-900">
        {awaiting.length === 0 ? (
          none
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {awaiting.map((o) => (
              <li key={o.reference} className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[16px] font-bold text-ink">{o.reference}</span>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", o.paymentClaim ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900")}>
                    {o.paymentClaim ? t("staffPay.claimedShort") : t("staffPay.notClaimed")}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 text-[13px] text-ink">
                  <span className="flex items-start gap-2">
                    <Phone className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      <b className="font-semibold">{o.customer.name}</b> ·{" "}
                      <a href={`tel:${o.phone}`} className="text-primary hover:underline">
                        {o.phone}
                      </a>
                    </span>
                  </span>
                  {o.address && (
                    <span className="flex items-start gap-2">
                      <BedDouble className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      {o.address}
                    </span>
                  )}
                  <span className="flex items-start gap-2 text-muted">
                    <Store className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    {o.restaurant.name}
                  </span>
                </div>
                <ul className="flex flex-wrap gap-1.5 text-[13px]">
                  {o.items.map((i, n) => (
                    <li key={n} className="rounded-full bg-canvas px-2.5 py-1 text-ink">
                      <b className="font-semibold tabular-nums">{i.quantity} ×</b> {i.name}
                    </li>
                  ))}
                </ul>
                {o.note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{t("customerNote", { note: o.note })}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-[12px] text-muted">{formatKigaliDateTime(locale, o.createdAt)}</span>
                  <span className="text-[16px] font-bold text-ink tabular-nums">{formatRWF(o.total, locale)}</span>
                </div>
                <ConfirmOrderPayment reference={o.reference} claimed={o.paymentClaim} />
                <StaffDeclineOrder reference={o.reference} />
              </li>
            ))}
          </ul>
        )}
      </Group>

      <Group id="to-send" title={t("staffOrders.toSend")} count={toSend.length} tone="bg-primary/10 text-primary">
        {toSend.length === 0 ? none : <OrdersBoard orders={toSend} />}
      </Group>

      <Group id="sent" title={t("staffOrders.sent")} count={sent.length} tone="bg-emerald-100 text-emerald-800">
        {sent.length === 0 ? none : <OrdersBoard orders={sent} />}
      </Group>

      {done.length > 0 && (
        <details className="rounded-2xl bg-surface px-4 ring-1 ring-line">
          <summary className="cursor-pointer py-3.5 text-[15px] font-semibold text-ink">
            {t("staffOrders.done")} <span className="text-muted tabular-nums">({done.length})</span>
          </summary>
          <div className="border-t border-line pb-2">
            {/* Each finished order opens to its details: money, who delivered, the desk, the guest, every step. */}
            <div className="pt-2">
              <FoodOrderList orders={finished} deletable />
            </div>
          </div>
        </details>
      )}
      </ScrollArea>
    </FillScreen>
  );
}
