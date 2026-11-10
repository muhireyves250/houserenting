"use client";

import { BadgeCheck, Check, Shirt } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { cancelMyLaundryAction, claimLaundryPaymentAction, requestLaundryAction } from "../actions";
import { laundryOwed, OPEN_LAUNDRY, type LaundryStatus } from "../rules";

export type GuestLaundry = {
  reference: string;
  status: LaundryStatus;
  note: string | null;
  pricePerKg: number;
  weightGrams: number | null;
  amount: number | null;
  paymentClaim: string | null;
  paidAt: Date | null;
  cancelReason: string | null;
};

const input = "w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus:border-primary";
const STEPS = ["REQUESTED", "PICKED_UP", "WASHED", "RETURNED"] as const satisfies readonly LaundryStatus[];

/** My stay: ask for a laundry pickup, follow it (collected, washed and weighed, returned) and pay by weight. */
export function LaundryCard({ booking, pricePerKg, orders, instructions }: { booking: string; pricePerKg: number; orders: GuestLaundry[]; instructions: string | null }) {
  const t = useTranslations("Laundry");
  const locale = useLocale();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = orders.some((o) => OPEN_LAUNDRY.includes(o.status));

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-1 text-[14px] text-muted">{pricePerKg === 0 ? t("freeIntro") : t("paidIntro", { price: formatRWF(pricePerKg, locale) })}</p>

      {!open && (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
            {t("noteLabel")}
            <textarea className={cn(input, "min-h-20")} value={note} maxLength={300} placeholder={t("notePlaceholder")} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const result = await requestLaundryAction(booking, note);
                if (result.ok) {
                  setNote("");
                  router.refresh();
                } else setError(t(`error.${result.error}`));
              })
            }
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-[15px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
          >
            <Shirt className="size-5" aria-hidden="true" />
            {t("request")}
          </button>
        </div>
      )}

      {orders.length > 0 && (
        <ul className="flex flex-col gap-3">
          {orders.map((o) => (
            <LaundryRow key={o.reference} order={o} instructions={instructions} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LaundryRow({ order, instructions }: { order: GuestLaundry; instructions: string | null }) {
  const t = useTranslations("Laundry");
  const locale = useLocale();
  const router = useRouter();
  const [tx, setTx] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const cancelled = order.status === "CANCELLED";
  const at = (STEPS as readonly LaundryStatus[]).indexOf(order.status);
  const owed = laundryOwed(order);
  const kg = order.weightGrams !== null ? (order.weightGrams / 1000).toLocaleString(locale, { maximumFractionDigits: 2 }) : null;

  return (
    <li className="rounded-2xl bg-canvas p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[13px] font-semibold text-ink">{order.reference}</p>
          <p className="text-[14px] font-semibold text-ink">{t(`status.${order.status}`)}</p>
        </div>
        {order.paidAt ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-bold text-emerald-800">{t("paid")}</span>
        ) : order.amount === 0 && order.status !== "REQUESTED" && order.status !== "PICKED_UP" && !cancelled ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-bold text-emerald-800">{t("free")}</span>
        ) : null}
      </div>

      {!cancelled && (
        <ol className="mt-3 grid grid-cols-4 gap-1" aria-label={t("progress")}>
          {STEPS.map((step, i) => (
            <li key={step} className="flex flex-col items-center gap-1 text-center">
              <span className={cn("flex size-6 items-center justify-center rounded-full text-[11px] font-bold", i <= at ? "bg-primary text-white" : "bg-line text-muted")}>
                {i <= at ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <span className={cn("text-[11px] leading-tight", i <= at ? "font-semibold text-ink" : "text-muted")}>{t(`step.${step}`)}</span>
            </li>
          ))}
        </ol>
      )}

      {order.note && <p className="mt-3 text-[13px] text-muted">{t("yourNote", { note: order.note })}</p>}
      {cancelled && order.cancelReason && <p className="mt-2 text-[13px] text-red-800">{t("cancelledBecause", { reason: order.cancelReason })}</p>}

      {kg !== null && order.amount !== null && (
        <p className="mt-3 flex justify-between gap-3 border-t border-line pt-3 text-[14px]">
          <span className="text-muted">{t("weighed", { kg, price: formatRWF(order.pricePerKg, locale) })}</span>
          <b className="text-ink tabular-nums">{order.amount > 0 ? formatRWF(order.amount, locale) : t("free")}</b>
        </p>
      )}

      {owed &&
        (order.paymentClaim ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-[14px] text-emerald-900">
            <BadgeCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            {t("waiting", { reference: order.paymentClaim })}
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <div className="rounded-xl bg-surface px-4 py-3 text-[14px] text-ink ring-1 ring-line">
              <p className="font-semibold">{t("howToPay", { amount: formatRWF(order.amount ?? 0, locale) })}</p>
              <p className="mt-1 whitespace-pre-line text-ink/80">{instructions ?? t("noInstructions")}</p>
              <p className="mt-1 text-[13px] text-muted">{t("useReference", { reference: order.reference })}</p>
            </div>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
              {t("transactionId")}
              <input className={input} value={tx} maxLength={60} placeholder={t("transactionHint")} onChange={(e) => setTx(e.target.value)} />
            </label>
            {error && (
              <p role="alert" className="text-[13px] font-medium text-danger">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={pending || tx.trim().length < 4}
              onClick={() =>
                start(async () => {
                  const result = await claimLaundryPaymentAction(order.reference, tx);
                  if (result.ok) router.refresh();
                  else setError(t(`payError.${result.error}`));
                })
              }
              className="rounded-full bg-primary px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {t("ivePaid")}
            </button>
          </div>
        ))}

      {order.status === "REQUESTED" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (await cancelMyLaundryAction(order.reference)) router.refresh();
            })
          }
          className="mt-3 text-[13px] font-semibold text-red-700 hover:underline disabled:opacity-50"
        >
          {t("cancel")}
        </button>
      )}
    </li>
  );
}
