"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { frontDeskMoveAction, markNoShowAction } from "../actions";

/** Check-in, check-out and no-show buttons for the place's team. */
export function FrontDesk({ reference, status, checkIn, today }: { reference: string; status: string; checkIn: string; today: string }) {
  const t = useTranslations("Portal");
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const run = (action: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      const { ok } = await action();
      setFailed(!ok);
      if (ok) router.refresh();
    });
  const button = "rounded-full px-4 py-2 text-[13px] font-semibold disabled:opacity-50";
  return (
    <span className="flex flex-wrap items-center gap-2">
      {status === "CONFIRMED" && checkIn <= today && (
        <button type="button" disabled={pending} onClick={() => run(() => frontDeskMoveAction(reference, "CHECKED_IN"))} className={`${button} bg-primary text-white`}>
          {t("checkIn")}
        </button>
      )}
      {status === "CHECKED_IN" && (
        <button type="button" disabled={pending} onClick={() => run(() => frontDeskMoveAction(reference, "COMPLETED"))} className={`${button} bg-primary text-white`}>
          {t("checkOut")}
        </button>
      )}
      {status === "CONFIRMED" && checkIn < today && (
        <button type="button" disabled={pending} onClick={() => run(() => markNoShowAction(reference))} className={`${button} border border-line text-danger`}>
          {t("noShow")}
        </button>
      )}
      {failed && <span className="text-[13px] text-danger">{t("failed")}</span>}
    </span>
  );
}
