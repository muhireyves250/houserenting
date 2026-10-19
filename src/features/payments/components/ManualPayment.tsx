"use client";

import { BadgeCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { claimPaymentAction, confirmPaymentAction, rejectPaymentAction } from "../manual-actions";

const input = "w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus:border-primary";

/** Guest: how to pay, then "I've paid" with the transaction id; the owner or staff confirm it. */
export function PaymentClaim({ reference, amount, instructions, claimed }: { reference: string; amount: number; instructions: string | null; claimed: string | null }) {
  const t = useTranslations("ManualPay");
  const locale = useLocale();
  const router = useRouter();
  const [tx, setTx] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (claimed) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-[14px] text-emerald-900">
        <BadgeCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        {t("waiting", { reference: claimed })}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-canvas px-4 py-3 text-[14px] text-ink">
        <p className="font-semibold">{t("howToPay", { amount: formatRWF(amount, locale) })}</p>
        <p className="mt-1 whitespace-pre-line text-ink/80">{instructions ?? t("noInstructions")}</p>
        <p className="mt-1 text-[13px] text-muted">{t("useReference", { reference })}</p>
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
            const result = await claimPaymentAction(reference, tx);
            if (result.ok) router.refresh();
            else setError(t(`claimError.${result.error}`));
          })
        }
        className="rounded-full bg-primary px-5 py-3 text-[15px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {t("ivePaid")}
      </button>
    </div>
  );
}

/** Owner or staff: confirm the money arrived (or say it didn't). */
export function ConfirmPayment({ reference, total, claimed }: { reference: string; total: number; claimed: string | null }) {
  const t = useTranslations("ManualPay");
  const locale = useLocale();
  const router = useRouter();
  const [tx, setTx] = useState(claimed ?? "");
  const [amount, setAmount] = useState(String(total));
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3">
      <p className="text-[14px] font-semibold text-ink">{claimed ? t("guestSaysPaid", { tx: claimed }) : t("notPaidYet", { amount: formatRWF(total, locale) })}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("transactionId")}
          <input className={input} value={tx} maxLength={60} onChange={(e) => setTx(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("amountReceived")}
          <input className={input} type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted">{t("checkFirst")}</p>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || tx.trim().length < 4}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await confirmPaymentAction(reference, tx, Number(amount));
              if (result.ok) router.refresh();
              else setError(t(`confirmError.${result.error}`));
            })
          }
          className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {t("confirm")}
        </button>
        {claimed && !rejecting && (
          <button type="button" onClick={() => setRejecting(true)} className="rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-danger">
            {t("notReceived")}
          </button>
        )}
      </div>
      {rejecting && (
        <div className="flex flex-col gap-2">
          <input className={input} value={reason} maxLength={300} placeholder={t("rejectReason")} onChange={(e) => setReason(e.target.value)} />
          <button
            type="button"
            disabled={pending || !reason.trim()}
            onClick={() =>
              start(async () => {
                const { ok } = await rejectPaymentAction(reference, reason);
                if (ok) router.refresh();
              })
            }
            className="self-start rounded-full bg-danger px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {t("notReceivedConfirm")}
          </button>
        </div>
      )}
    </div>
  );
}
