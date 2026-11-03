"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { submitListingAction } from "../actions";

/** Send the place for review (drafts and places VIIPA sent back). Removing a place is done by VIIPA. */
export function ListingActions({ listingId, canSubmit }: { listingId: string; canSubmit: boolean }) {
  const t = useTranslations("Host");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  if (!canSubmit) return null;
  return (
    <div className="flex flex-col gap-3">
      <Button
        size="lg"
        fullWidth
        loading={pending}
        onClick={() =>
          start(async () => {
            const { ok } = await submitListingAction(listingId);
            setMessage(ok ? t("submitted") : t("errors.failed"));
            if (ok) router.refresh();
          })
        }
      >
        {t("submit")}
      </Button>
      {message && (
        <p role="status" className="text-center text-[13px] text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
