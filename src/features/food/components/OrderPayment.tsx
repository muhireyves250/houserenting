"use client";

import { BadgeCheck, Smartphone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { claimOrderPaymentAction } from "../actions";

/** Pay-first orders: how to pay by mobile money, then "I've paid" with the transaction ID; VIIPA confirms. */
export function OrderPayment({ reference, amount, instructions, claimed }: { reference: string; amount: number; instructions: string | null; claimed: string | null }) {
  const t = useTranslations("Food.pay");
  const locale = useLocale();
  const router = useRouter();
  const [tx, setTx] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (claimed) {
    return (
      <p className="flex items-start gap-3 rounded-2xl bg-emerald-50 px-4 py-3.5 text-[14px] text-emerald-900">
        <BadgeCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span>
          <b className="block font-semibold">{t("waitingTitle")}</b>
          {t("waiting", { reference: claimed })}
        </span>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3 rounded-2xl bg-primary-soft px-4 py-3.5 text-[14px] text-ink">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0">
          <b className="block text-[15px] font-semibold">{t("howTo", { amount: formatRWF(amount, locale) })}</b>
          <span className="mt-1 block whitespace-pre-line text-ink/80">{instructions ?? t("noInstructions")}</span>
          <span className="mt-1 block text-[13px] text-muted">{t("useReference", { reference })}</span>
        </span>
      </div>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        {t("transactionId")}
        <input
          className="w-full rounded-xl border border-line-strong bg-surface px-3 py-3 text-[15px] text-ink outline-none focus:border-primary"
          value={tx}
          maxLength={60}
          placeholder={t("transactionHint")}
          onChange={(e) => setTx(e.target.value)}
        />
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
            const result = await claimOrderPaymentAction(reference, tx);
            if (result.ok) router.refresh();
            else setError(t(`error.${result.error}`));
          })
        }
        className="rounded-full bg-primary px-5 py-3.5 text-[15px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {t("ivePaid")}
      </button>
    </div>
  );
}
