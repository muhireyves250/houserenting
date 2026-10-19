"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { setRestaurantPausedAction, setRestaurantStatusAction } from "../actions";

/** Open/closed for orders right now (the team), without hiding the restaurant. */
export function PauseToggle({ restaurantId, paused }: { restaurantId: string; paused: boolean }) {
  const t = useTranslations("Food");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setRestaurantPausedAction(restaurantId, !paused);
          router.refresh();
        })
      }
      className={paused ? "rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white" : "rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink"}
    >
      {paused ? t("openOrders") : t("pauseOrders")}
    </button>
  );
}

/** Staff: publish, or hide with a reason the owner sees. */
export function RestaurantStatusActions({ restaurantId, status }: { restaurantId: string; status: "DRAFT" | "PUBLISHED" | "HIDDEN" }) {
  const t = useTranslations("Food");
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const run = (to: "PUBLISHED" | "HIDDEN") =>
    start(async () => {
      const { ok } = await setRestaurantStatusAction(restaurantId, to, reason);
      setFailed(!ok);
      if (ok) {
        setReason("");
        router.refresh();
      }
    });
  return (
    <div className="flex flex-col gap-2">
      {status !== "PUBLISHED" ? (
        <button type="button" disabled={pending} onClick={() => run("PUBLISHED")} className="self-start rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          {status === "HIDDEN" ? t("showAgain") : t("publish")}
        </button>
      ) : (
        <>
          <input value={reason} maxLength={500} placeholder={t("hideReason")} onChange={(e) => setReason(e.target.value)} className="w-full rounded-xl border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-primary" />
          <button type="button" disabled={pending || !reason.trim()} onClick={() => run("HIDDEN")} className="self-start rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-danger disabled:opacity-50">
            {t("hide")}
          </button>
        </>
      )}
      {failed && <p className="text-[13px] font-medium text-danger">{t("publishFailed")}</p>}
    </div>
  );
}
