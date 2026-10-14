"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useRouter } from "@/i18n/navigation";
import { cancelBookingAction } from "../actions";

/** "Cancel booking" for an unpaid hold, confirmed in a window first (like Log out). */
export function CancelBooking({ reference }: { reference: string }) {
  const t = useTranslations("Bookings");
  const tHome = useTranslations("Home");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function cancel() {
    setFailed(false);
    startTransition(async () => {
      const { ok } = await cancelBookingAction(reference);
      if (!ok) {
        setFailed(true);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" size="lg" fullWidth onClick={() => setConfirming(true)} className="text-danger">
        {t("cancel")}
      </Button>
      {confirming && (
        <Modal title={t("cancelTitle")} closeLabel={tHome("close")} onClose={() => setConfirming(false)}>
          <p className="-mt-2 text-center text-[15px] leading-6 text-muted">{t("cancelBody")}</p>
          {failed && (
            <p role="alert" className="mt-4 text-center text-sm font-medium text-danger">
              {t("cancelFailed")}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-3">
            <Button size="lg" fullWidth loading={pending} onClick={cancel} className="bg-danger hover:bg-danger/90">
              {t("cancel")}
            </Button>
            <Button size="lg" fullWidth variant="outline" onClick={() => setConfirming(false)}>
              {t("keep")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
