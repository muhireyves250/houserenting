"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { decideStayRequestAction, markNoShowAction, settleRefundAction } from "../actions";
import type { StayRequestKind } from "../rules";

const input = "w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-primary";

/** Staff answer a guest's request: approve (with a refund amount for cancellations/shorter stays) or decline with a reason. */
export function DecideRequest({ requestId, kind, total, suggestedRefund }: { requestId: string; kind: StayRequestKind; total: number; suggestedRefund: number | null }) {
  const t = useTranslations("MyStay");
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [refund, setRefund] = useState(suggestedRefund === null ? "" : String(suggestedRefund));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const refunds = kind === "CANCEL" || kind === "SHORTEN";

  const run = (approve: boolean) =>
    start(async () => {
      setError(null);
      const amount = refunds && refund !== "" ? Number(refund) : null;
      const result = await decideStayRequestAction(requestId, approve, response, amount);
      if (result.ok) router.refresh();
      else setError(t(`decideError.${result.error}`));
    });

  return (
    <div className="mt-2 flex flex-col gap-2">
      {refunds && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          {t("refundAmount", { max: total })}
          <input type="number" min={0} max={total} className={input} value={refund} onChange={(e) => setRefund(e.target.value)} />
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        {t("replyToGuest")}
        <textarea rows={2} maxLength={500} className={input} value={response} onChange={(e) => setResponse(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => run(true)} className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
          {t("approve")}
        </button>
        <button
          type="button"
          disabled={pending || !response.trim()}
          onClick={() => run(false)}
          className="rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-danger hover:border-danger disabled:opacity-50"
        >
          {t("decline")}
        </button>
      </div>
    </div>
  );
}

/** A refund waiting to be sent: staff confirm it was sent, or decline it with a reason. */
export function SettleRefund({ reference, amount }: { reference: string; amount: number }) {
  const t = useTranslations("MyStay");
  const locale = useLocale();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const run = (outcome: "REFUNDED" | "DECLINED") =>
    start(async () => {
      const { ok } = await settleRefundAction(reference, outcome, note);
      if (ok) router.refresh();
    });
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] text-ink">{t("refundToSend", { amount: formatRWF(amount, locale) })}</p>
      <input className={input} maxLength={200} placeholder={t("refundNote")} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => run("REFUNDED")} className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          {t("refundSent")}
        </button>
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={() => run("DECLINED")}
          className={cn("rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-danger disabled:opacity-50")}
        >
          {t("refundDecline")}
        </button>
      </div>
    </div>
  );
}

export function NoShowButton({ reference }: { reference: string }) {
  const t = useTranslations("MyStay");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const { ok } = await markNoShowAction(reference);
          if (ok) router.refresh();
        })
      }
      className="rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-danger hover:border-danger disabled:opacity-50"
    >
      {t("markNoShow")}
    </button>
  );
}
