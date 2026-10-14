"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useRouter } from "@/i18n/navigation";
import { archiveListingAction, submitListingAction } from "../actions";

/** Send for review (drafts / listings that need changes) and remove the listing. */
export function ListingActions({ listingId, canSubmit }: { listingId: string; canSubmit: boolean }) {
  const t = useTranslations("Host");
  const tHome = useTranslations("Home");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {canSubmit && (
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
      )}
      {message && (
        <p role="status" className="text-center text-[13px] text-muted">
          {message}
        </p>
      )}
      <Button variant="outline" size="lg" fullWidth onClick={() => setConfirming(true)} className="text-danger">
        {t("archive")}
      </Button>
      {confirming && (
        <Modal title={t("archiveTitle")} closeLabel={tHome("close")} onClose={() => setConfirming(false)}>
          <p className="-mt-2 text-center text-[15px] leading-6 text-muted">{t("archiveBody")}</p>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              size="lg"
              fullWidth
              loading={pending}
              className="bg-danger hover:bg-danger/90"
              onClick={() =>
                start(async () => {
                  const { ok } = await archiveListingAction(listingId);
                  if (ok) router.replace("/host");
                })
              }
            >
              {t("archive")}
            </Button>
            <Button size="lg" fullWidth variant="outline" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
