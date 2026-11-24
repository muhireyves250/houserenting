"use client";

import { Check, Home, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { decideKitchenRequestAction } from "../actions";

/** Staff: a restaurant's applications to cook for places. Approve (it then cooks there) or decline with a reason. */
export function KitchenRequests({ requests }: { requests: { id: string; note: string | null; createdAt: Date; listing: { id: string; title: string } }[] }) {
  const t = useTranslations("Food.placeKitchens");
  const router = useRouter();
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const decide = (id: string, approve: boolean) =>
    start(async () => {
      const ok = await decideKitchenRequestAction(id, approve, reason);
      setError(!ok);
      if (ok) {
        setDeclining(null);
        setReason("");
        router.refresh();
      }
    });
  return (
    <ul className="flex flex-col gap-3">
      {requests.map((q) => (
        <li key={q.id} className="flex flex-col gap-2.5 rounded-2xl bg-amber-50 p-3.5 ring-1 ring-amber-200">
          <span className="flex items-start gap-2.5">
            <Home className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
            <span className="min-w-0 text-[14px] text-amber-950">
              <b className="font-semibold">{t("wantsToCook", { place: q.listing.title })}</b>
              {q.note && <span className="mt-0.5 block text-[13px] text-amber-900">“{q.note}”</span>}
            </span>
          </span>
          {declining === q.id ? (
            <span className="flex gap-2">
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={t("declineReason")} aria-label={t("declineReason")} className="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px]" />
              <button type="button" disabled={pending || !reason.trim()} onClick={() => decide(q.id, false)} className="rounded-xl bg-danger px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
                {t("decline")}
              </button>
            </span>
          ) : (
            <span className="grid grid-cols-2 gap-2">
              <button type="button" disabled={pending} onClick={() => setDeclining(q.id)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-surface text-[14px] font-semibold text-danger ring-1 ring-red-200 disabled:opacity-50">
                <X className="size-4" aria-hidden="true" />
                {t("decline")}
              </button>
              <button type="button" disabled={pending} onClick={() => decide(q.id, true)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary text-[14px] font-semibold text-white disabled:opacity-50">
                <Check className="size-4" aria-hidden="true" />
                {t("approve")}
              </button>
            </span>
          )}
        </li>
      ))}
      {error && <li className="text-[13px] font-medium text-danger">{t("failed")}</li>}
    </ul>
  );
}
