"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { moveOrderAction } from "../actions";

/** Staff decline an order (e.g. never paid, or the restaurant can't cook it), with the reason the guest sees. */
export function StaffDeclineOrder({ reference }: { reference: string }) {
  const t = useTranslations("Food");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-[13px] font-semibold text-danger hover:underline">
        {t("decline")}
      </button>
    );
  return (
    <div className="flex gap-2">
      <input value={reason} maxLength={300} placeholder={t("declineReason")} onChange={(e) => setReason(e.target.value)} className="min-w-0 flex-1 rounded-xl border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-primary" />
      <button
        type="button"
        disabled={pending || !reason.trim()}
        onClick={() =>
          start(async () => {
            await moveOrderAction(reference, "CANCELLED", reason);
            router.refresh();
          })
        }
        className="rounded-full bg-danger px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
      >
        {t("declineConfirm")}
      </button>
    </div>
  );
}
