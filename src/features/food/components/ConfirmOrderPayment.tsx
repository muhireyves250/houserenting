"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { confirmOrderPaymentAction } from "../actions";

/** Staff: confirm a pay-first order's mobile money payment (the guest's transaction, or one typed here). */
export function ConfirmOrderPayment({ reference, claimed }: { reference: string; claimed: string | null }) {
  const t = useTranslations("Food.staffPay");
  const router = useRouter();
  const [tx, setTx] = useState(claimed ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="w-44 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-primary"
          placeholder={t("paidRef")}
          aria-label={t("paidRef")}
          value={tx}
          maxLength={60}
          onChange={(e) => setTx(e.target.value)}
        />
        <button
          type="button"
          disabled={pending || tx.trim().length < 4}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await confirmOrderPaymentAction(reference, tx);
              if (result.ok) router.refresh();
              else setError(t(`error.${result.error}`));
            })
          }
          className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {t("confirm")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
