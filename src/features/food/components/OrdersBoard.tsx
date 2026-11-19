"use client";

import { BedDouble, Phone, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { ConfirmAction } from "@/features/admin/components/ConfirmAction";
import { deleteFoodOrderAction, moveOrderAction } from "../actions";
import type { Fulfilment, OrderStatus } from "../rules";

export type BoardOrder = {
  reference: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  customer: string;
  phone: string;
  /** Where it goes (the guest's place and room), or the delivery address. */
  address: string | null;
  /** The restaurant it comes from (staff view). */
  kitchen?: string | null;
  note: string | null;
  total: number;
  createdAt: Date;
  items: { name: string; quantity: number }[];
  /** Steps this person may take now. */
  steps: OrderStatus[];
  /** Whether money was received (paid orders are never deleted). */
  paid?: boolean;
};

export const ORDER_TONE: Record<OrderStatus, string> = {
  PLACED: "bg-amber-100 text-amber-900",
  ACCEPTED: "bg-primary/10 text-primary",
  PREPARING: "bg-primary/10 text-primary",
  READY: "bg-primary/10 text-primary",
  OUT_FOR_DELIVERY: "bg-emerald-100 text-emerald-800",
  DELIVERED: "bg-canvas text-muted",
  CANCELLED: "bg-red-50 text-red-700",
};

function Line({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 shrink-0 text-primary [&>svg]:size-4">{icon}</span>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/**
 * Orders as cards: number, status and total on top; who, where and from which kitchen; the dishes; the next
 * steps. `compact` shows finished orders as one-line rows.
 */
export function OrdersBoard({ orders, compact = false, staffDelete = false }: { orders: BoardOrder[]; compact?: boolean; /** Staff may delete cancelled, unpaid orders. */ staffDelete?: boolean }) {
  const t = useTranslations("Food");
  const locale = useLocale();
  const router = useRouter();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: "Africa/Kigali" });
  const move = (reference: string, to: OrderStatus, note = "") =>
    start(async () => {
      await moveOrderAction(reference, to, note);
      setCancelling(null);
      setReason("");
      router.refresh();
    });

  if (orders.length === 0) return <p className="py-6 text-center text-[14px] text-muted">{t("noOrders")}</p>;

  if (compact)
    return (
      <ul className="flex flex-col divide-y divide-line">
        {orders.map((o) => (
          <li key={o.reference} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2.5 text-[13px]">
            <span className="font-mono font-semibold text-ink">{o.reference}</span>
            <span className="min-w-0 flex-1 truncate text-muted">
              {o.customer}
              {o.address && ` · ${o.address}`}
            </span>
            <span className="text-muted">{time.format(o.createdAt)}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", ORDER_TONE[o.status])}>{t(`status.${o.status}`)}</span>
            <span className="w-20 text-right font-semibold text-ink tabular-nums">{formatRWF(o.total, locale)}</span>
            {staffDelete && o.status === "CANCELLED" && o.paid === false && (
              <ConfirmAction label={t("staffOrders.delete")} question={t("staffOrders.deleteQuestion")} action={deleteFoodOrderAction.bind(null, o.reference)} />
            )}
          </li>
        ))}
      </ul>
    );

  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {orders.map((o) => (
        <li key={o.reference} className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[16px] font-bold text-ink">{o.reference}</span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", ORDER_TONE[o.status])}>{t(`status.${o.status}`)}</span>
          </div>
          <div className="flex flex-col gap-1.5 text-[13px] text-ink">
            <Line icon={<Phone />}>
              <b className="font-semibold">{o.customer}</b> ·{" "}
              <a href={`tel:${o.phone}`} className="text-primary hover:underline">
                {o.phone}
              </a>
            </Line>
            {o.address && <Line icon={<BedDouble />}>{o.address}</Line>}
            {o.kitchen && (
              <Line icon={<Store />}>
                <span className="text-muted">{o.kitchen}</span>
              </Line>
            )}
          </div>
          <ul className="flex flex-wrap gap-1.5 text-[13px]">
            {o.items.map((i, n) => (
              <li key={n} className="rounded-full bg-canvas px-2.5 py-1 text-ink">
                <b className="font-semibold tabular-nums">{i.quantity} ×</b> {i.name}
              </li>
            ))}
          </ul>
          {o.note && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">{t("customerNote", { note: o.note })}</p>}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <span className="text-[12px] text-muted">{time.format(o.createdAt)}</span>
            <span className="text-[16px] font-bold text-ink tabular-nums">{formatRWF(o.total, locale)}</span>
          </div>
          {o.steps.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {o.steps
                .filter((s) => s !== "CANCELLED")
                .map((step) => (
                  <button key={step} type="button" disabled={pending} onClick={() => move(o.reference, step)} className="flex-1 rounded-full bg-primary px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
                    {t(`step.${step as "ACCEPTED"}`)}
                  </button>
                ))}
              {o.steps.includes("CANCELLED") && (
                <button type="button" disabled={pending} onClick={() => setCancelling(cancelling === o.reference ? null : o.reference)} className="rounded-full border border-line px-4 py-2.5 text-[14px] font-semibold text-danger disabled:opacity-50">
                  {t("decline")}
                </button>
              )}
            </div>
          )}
          {cancelling === o.reference && (
            <div className="flex gap-2">
              <input
                value={reason}
                maxLength={300}
                placeholder={t("declineReason")}
                onChange={(e) => setReason(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-primary"
              />
              <button type="button" disabled={pending || !reason.trim()} onClick={() => move(o.reference, "CANCELLED", reason)} className="rounded-full bg-danger px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
                {t("declineConfirm")}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
