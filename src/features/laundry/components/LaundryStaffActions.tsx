"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { confirmLaundryPaymentAction, moveLaundryAction } from "../actions";
import { laundryOwed, OPEN_LAUNDRY, type LaundryStatus } from "../rules";

const input = "rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-primary";
const primary = "rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50";
const quiet = "rounded-full px-3 py-2 text-[13px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50";

/** Staff: the next step for one laundry order (collected → weight → returned), cancel, and confirm payment. */
export function LaundryStaffActions({
  order,
}: {
  order: { reference: string; status: LaundryStatus; amount: number | null; paidAt: Date | null; paymentClaim: string | null };
}) {
  const t = useTranslations("Laundry.admin");
  const router = useRouter();
  const [kg, setKg] = useState("");
  const [tx, setTx] = useState(order.paymentClaim ?? "");
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const result = await fn();
      if (result.ok) router.refresh();
      else setError(t(`error.${(result.error ?? "notFound") as "notFound"}`));
    });
  const move = (to: LaundryStatus, extra: { kg?: string; reason?: string } = {}) => run(() => moveLaundryAction(order.reference, to, extra));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {order.status === "REQUESTED" && (
          <button type="button" disabled={pending} onClick={() => move("PICKED_UP")} className={primary}>
            {t("pickedUp")}
          </button>
        )}
        {order.status === "PICKED_UP" && (
          <>
            <input className={`${input} w-28`} inputMode="decimal" placeholder={t("kg")} aria-label={t("kg")} value={kg} onChange={(e) => setKg(e.target.value)} />
            <button type="button" disabled={pending || !kg.trim()} onClick={() => move("WASHED", { kg })} className={primary}>
              {t("washed")}
            </button>
          </>
        )}
        {order.status === "WASHED" && (
          <button type="button" disabled={pending} onClick={() => move("RETURNED")} className={primary}>
            {t("returned")}
          </button>
        )}
        {OPEN_LAUNDRY.includes(order.status) && !cancelling && (
          <button type="button" disabled={pending} onClick={() => setCancelling(true)} className={quiet}>
            {t("cancel")}
          </button>
        )}
      </div>

      {cancelling && (
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${input} min-w-48 flex-1`} placeholder={t("cancelReason")} aria-label={t("cancelReason")} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
          <button type="button" disabled={pending || !reason.trim()} onClick={() => move("CANCELLED", { reason })} className={quiet}>
            {t("cancel")}
          </button>
        </div>
      )}

      {laundryOwed(order) && (
        <div className="flex flex-wrap items-center gap-2">
          <input className={`${input} w-48`} placeholder={t("paidRef")} aria-label={t("paidRef")} value={tx} maxLength={60} onChange={(e) => setTx(e.target.value)} />
          <button type="button" disabled={pending || tx.trim().length < 4} onClick={() => run(() => confirmLaundryPaymentAction(order.reference, tx))} className={primary}>
            {t("confirmPaid")}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
