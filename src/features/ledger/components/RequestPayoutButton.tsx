"use client";

import { Clock, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { requestPayoutAction } from "../actions";

/** Ask VIIPA to send the money owed now; after asking, says when (until VIIPA pays). */
export function RequestPayoutButton({ due, requestedOn, ready }: { due: string; requestedOn: string | null; ready: boolean }) {
  const t = useTranslations("Places.request");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (requestedOn)
    return (
      <p className="inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-[14px] font-medium text-amber-900 ring-1 ring-amber-200">
        <Clock className="size-4 shrink-0" aria-hidden="true" />
        {t("requested", { date: requestedOn })}
      </p>
    );
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={pending || !ready}
        onClick={() =>
          start(async () => {
            const r = await requestPayoutAction();
            if (r.ok) router.refresh();
            else setError(t(`error.${r.error === "auth" ? "noAccount" : r.error}`));
          })
        }
        className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-[15px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(0,87,184,0.9)] hover:bg-primary-hover disabled:opacity-50 disabled:shadow-none"
      >
        <Send className="size-4" aria-hidden="true" />
        {t("button", { amount: due })}
      </button>
      {!ready && <p className="text-[12px] text-muted">{t("notReady")}</p>}
      {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
    </div>
  );
}
