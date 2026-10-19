"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { moveOrderAction } from "../actions";
import type { Fulfilment, OrderStatus } from "../rules";

export type BoardOrder = {
  reference: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  customer: string;
  phone: string;
  address: string | null;
  note: string | null;
  total: number;
  createdAt: Date;
  items: { name: string; quantity: number }[];
  /** Steps this person may take now. */
  steps: OrderStatus[];
};

const TONE: Record<OrderStatus, string> = {
  PLACED: "bg-amber-50 text-amber-800",
  ACCEPTED: "bg-primary/10 text-primary",
  PREPARING: "bg-primary/10 text-primary",
  READY: "bg-emerald-50 text-emerald-800",
  OUT_FOR_DELIVERY: "bg-emerald-50 text-emerald-800",
  DELIVERED: "bg-canvas text-muted",
  CANCELLED: "bg-canvas text-muted",
};

/** Orders for the restaurant's team: newest first, with the next steps each person may take. */
export function OrdersBoard({ orders }: { orders: BoardOrder[] }) {
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

  if (orders.length === 0) return <p className="text-[14px] text-muted">{t("noOrders")}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {orders.map((o) => (
        <li key={o.reference} className="rounded-2xl border border-line p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span>
              <span className="block text-[15px] font-semibold text-ink">
                {o.customer} · <a href={`tel:${o.phone}`} className="text-primary">{o.phone}</a>
              </span>
              <span className="block text-xs text-muted">
                <span className="font-mono">{o.reference}</span> · {time.format(o.createdAt)} · {t(`fulfilment.${o.fulfilment}`)}
                {o.address && ` · ${o.address}`}
              </span>
            </span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[o.status])}>{t(`status.${o.status}`)}</span>
          </div>
          <p className="mt-2 text-[14px] text-ink">{o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</p>
          {o.note && <p className="text-[13px] text-muted">{t("customerNote", { note: o.note })}</p>}
          <p className="mt-1 text-[14px] font-semibold tabular-nums text-ink">{formatRWF(o.total, locale)}</p>
          {o.steps.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {o.steps.map((step) =>
                step === "CANCELLED" ? (
                  <button key={step} type="button" disabled={pending} onClick={() => setCancelling(o.reference)} className="rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-danger disabled:opacity-50">
                    {t("decline")}
                  </button>
                ) : (
                  <button key={step} type="button" disabled={pending} onClick={() => move(o.reference, step)} className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
                    {t(`step.${step as "ACCEPTED"}`)}
                  </button>
                ),
              )}
            </div>
          )}
          {cancelling === o.reference && (
            <div className="mt-3 flex flex-col gap-2">
              <input
                value={reason}
                maxLength={300}
                placeholder={t("declineReason")}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-primary"
              />
              <button type="button" disabled={pending || !reason.trim()} onClick={() => move(o.reference, "CANCELLED", reason)} className="self-end rounded-full bg-danger px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
                {t("declineConfirm")}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
