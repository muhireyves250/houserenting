"use client";

import { cn } from "@/lib/cn";
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
      role="switch"
      aria-checked={!paused}
      className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 transition-colors disabled:opacity-60", paused ? "bg-red-50 ring-red-200" : "bg-emerald-50 ring-emerald-200")}
    >
      {/* Open (taking orders) or closed: the state in words, and a big switch. */}
      <span className="flex flex-col">
        <span className={cn("text-[15px] font-bold", paused ? "text-red-800" : "text-emerald-800")}>{paused ? t("closedNowTitle") : t("openNowTitle")}</span>
        <span className="text-[12px] text-muted">{paused ? t("tapToOpen") : t("tapToClose")}</span>
      </span>
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", paused ? "bg-line-strong" : "bg-emerald-600")}>
        <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", paused ? "left-0.5" : "left-[22px]")} />
      </span>
    </button>
  );
}

/** Staff: publish, or hide with a reason the owner sees. */
export function RestaurantStatusActions({ restaurantId, status, compact = false }: { restaurantId: string; status: "DRAFT" | "PUBLISHED" | "HIDDEN"; compact?: boolean }) {
  const t = useTranslations("Food");
  const router = useRouter();
  // Compact (in lists): "Hide" first, then the reason box.
  const [asking, setAsking] = useState(!compact);
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
      ) : !asking ? (
        <button type="button" onClick={() => setAsking(true)} className="self-start rounded-full border border-line px-4 py-2 text-[13px] font-semibold text-danger hover:border-danger">
          {t("hide")}
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
