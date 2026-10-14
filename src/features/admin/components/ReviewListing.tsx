"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { reviewListingAction, unpublishListingAction } from "../actions";

/** Approve / send back with a reason (listings in review), or take a live listing down. */
export function ReviewListing({ listingId, mode }: { listingId: string; mode: "review" | "live" }) {
  const t = useTranslations("Admin");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (action: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      setError(null);
      const { ok } = await action();
      if (ok) router.refresh();
      else setError(t("actionFailed"));
    });

  const needReason = () => {
    if (reason.trim()) return true;
    setError(t("reasonNeeded"));
    return false;
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-0.5 rounded-xl border border-line-strong bg-surface px-4 py-2.5 focus-within:border-ink max-md:focus-within:border-primary">
        <span className="text-xs font-semibold text-muted">{t("reason")}</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3} className="w-full resize-y bg-transparent text-[15px] text-ink outline-none" />
      </label>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
      {mode === "review" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" fullWidth loading={pending} onClick={() => run(() => reviewListingAction(listingId, true))}>
            {t("approve")}
          </Button>
          <Button
            size="lg"
            variant="outline"
            fullWidth
            disabled={pending}
            className="text-danger"
            onClick={() => needReason() && run(() => reviewListingAction(listingId, false, reason))}
          >
            {t("reject")}
          </Button>
        </div>
      ) : (
        <Button
          size="lg"
          variant="outline"
          fullWidth
          disabled={pending}
          className="text-danger"
          onClick={() => needReason() && run(() => unpublishListingAction(listingId, reason))}
        >
          {t("unpublish")}
        </Button>
      )}
    </div>
  );
}
