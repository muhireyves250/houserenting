"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/features/hosting/components/fields";
import { useRouter } from "@/i18n/navigation";
import { formatRWF } from "@/lib/format";
import { decideRewardAction, recordSettlementAction } from "../money-actions";

/** Record a payout to one owner (up to what is due). */
export function PayoutForm({ hostId, due }: { hostId: string; due: number }) {
  const t = useTranslations("Money");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(due));
  const [method, setMethod] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (due <= 0) return null;
  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        {t("recordPayout")}
      </Button>
    );
  }
  return (
    <div className="mt-3 grid w-full gap-2 sm:grid-cols-3">
      <Field label={t("amount", { due: formatRWF(due, locale) })} type="number" min={1} max={due} value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Field label={t("method")} value={method} maxLength={60} onChange={(e) => setMethod(e.target.value)} />
      <Field label={t("externalRef")} value={externalReference} maxLength={120} onChange={(e) => setExternalReference(e.target.value)} />
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger sm:col-span-3">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 sm:col-span-3">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {t("cancel")}
        </Button>
        <Button
          loading={pending}
          disabled={!method.trim() || !(Number(amount) > 0)}
          onClick={() =>
            start(async () => {
              const result = await recordSettlementAction({ hostId, amount: Number(amount), method, externalReference });
              if (result.ok) {
                setOpen(false);
                router.refresh();
              } else setError(t(`error.${result.error}`));
            })
          }
        >
          {t("save")}
        </Button>
      </div>
    </div>
  );
}

export function RewardButtons({ rewardId }: { rewardId: string }) {
  const t = useTranslations("Money");
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (approve: boolean) =>
    start(async () => {
      await decideRewardAction(rewardId, approve);
      router.refresh();
    });
  return (
    <span className="flex gap-2">
      <button type="button" disabled={pending} onClick={() => run(true)} className="rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
        {t("approve")}
      </button>
      <button type="button" disabled={pending} onClick={() => run(false)} className="rounded-lg bg-canvas px-3.5 py-1.5 text-[13px] font-semibold text-danger hover:bg-line/70 disabled:opacity-50">
        {t("void")}
      </button>
    </span>
  );
}
