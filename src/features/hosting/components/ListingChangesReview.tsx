"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { decideListingChangesAction } from "../actions";

/** Staff: what the owner changed on a live place (before → after), then Approve or Decline with a reason. */
export function ListingChangesReview({ listingId, changes }: { listingId: string; changes: { label: string; before: string; after: string }[] }) {
  const t = useTranslations("Admin.listingChanges");
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const decide = (approve: boolean) =>
    start(async () => {
      const ok = await decideListingChangesAction(listingId, approve, reason);
      setFailed(!ok);
      if (ok) router.refresh();
    });
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="text-[15px] font-bold text-amber-950">{t("title")}</p>
      {changes.length === 0 ? (
        <p className="text-[13px] text-amber-900">{t("same")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {changes.map((c) => (
            <li key={c.label} className="rounded-xl bg-surface p-3 text-[13px] ring-1 ring-amber-100">
              <b className="block font-semibold text-ink">{c.label}</b>
              <span className="block break-words text-muted line-through">{c.before || "—"}</span>
              <span className="block break-words text-ink">{c.after || "—"}</span>
            </li>
          ))}
        </ul>
      )}
      {declining ? (
        <span className="flex gap-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={t("reason")} aria-label={t("reason")} className="min-w-0 flex-1 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px]" />
          <button type="button" disabled={pending || !reason.trim()} onClick={() => decide(false)} className="rounded-xl bg-danger px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {t("decline")}
          </button>
        </span>
      ) : (
        <span className="grid grid-cols-2 gap-2">
          <button type="button" disabled={pending} onClick={() => setDeclining(true)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-surface text-[14px] font-semibold text-danger ring-1 ring-red-200">
            <X className="size-4" aria-hidden="true" />
            {t("decline")}
          </button>
          <button type="button" disabled={pending} onClick={() => decide(true)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary text-[14px] font-semibold text-white disabled:opacity-50">
            <Check className="size-4" aria-hidden="true" />
            {t("approve")}
          </button>
        </span>
      )}
      {failed && <p className="text-[13px] font-medium text-danger">{t("failed")}</p>}
    </div>
  );
}
