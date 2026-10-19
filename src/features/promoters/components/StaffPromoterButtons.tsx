"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { decidePromoterRewardAction, markPromoterRewardPaidAction, setPromoterStatusAction } from "../actions";

const small = "rounded-full px-3 py-1.5 text-[13px] font-semibold disabled:opacity-50";

export function PromoterStatusButtons({ promoterId, status }: { promoterId: string; status: "PENDING" | "ACTIVE" | "SUSPENDED" }) {
  const t = useTranslations("Promoters");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();
  const run = (to: "ACTIVE" | "SUSPENDED") =>
    start(async () => {
      const { ok } = await setPromoterStatusAction(promoterId, to, reason);
      if (ok) {
        setAsking(false);
        setReason("");
        router.refresh();
      }
    });
  return (
    <span className="flex flex-wrap items-center gap-2">
      {status !== "ACTIVE" && (
        <button type="button" disabled={pending} onClick={() => run("ACTIVE")} className={`${small} bg-primary text-white`}>
          {status === "PENDING" ? t("approve") : t("reactivate")}
        </button>
      )}
      {status !== "SUSPENDED" &&
        (asking ? (
          <>
            <input value={reason} maxLength={300} placeholder={t("suspendReason")} onChange={(e) => setReason(e.target.value)} className="rounded-lg border border-line-strong px-2 py-1 text-[13px]" />
            <button type="button" disabled={pending || !reason.trim()} onClick={() => run("SUSPENDED")} className={`${small} bg-danger text-white`}>
              {t("suspend")}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setAsking(true)} className={`${small} border border-line text-danger`}>
            {status === "PENDING" ? t("decline") : t("suspend")}
          </button>
        ))}
    </span>
  );
}

export function PromoterRewardButtons({ rewardId, status }: { rewardId: string; status: "PENDING" | "APPROVED" }) {
  const t = useTranslations("Promoters");
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      const { ok } = await action();
      if (ok) router.refresh();
    });
  return status === "PENDING" ? (
    <span className="flex gap-2">
      <button type="button" disabled={pending} onClick={() => run(() => decidePromoterRewardAction(rewardId, true))} className={`${small} bg-primary text-white`}>
        {t("approve")}
      </button>
      <button type="button" disabled={pending} onClick={() => run(() => decidePromoterRewardAction(rewardId, false))} className={`${small} border border-line text-danger`}>
        {t("void")}
      </button>
    </span>
  ) : (
    <button type="button" disabled={pending} onClick={() => run(() => markPromoterRewardPaidAction(rewardId))} className={`${small} bg-primary text-white`}>
      {t("markPaid")}
    </button>
  );
}
