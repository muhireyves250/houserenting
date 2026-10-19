"use client";

import { LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

/** Sorts restaurants by distance from where the phone is (asks for location only when tapped). */
export function NearMe({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("Food");
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "denied">("idle");
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        disabled={state === "busy"}
        onClick={() => {
          if (!navigator.geolocation) return setState("denied");
          setState("busy");
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setState("idle");
              router.replace({ pathname: "/restaurants", query: { lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) } });
            },
            () => setState("denied"),
            { timeout: 10_000, maximumAge: 300_000 },
          );
        }}
        aria-label={compact ? t("nearMe") : undefined}
        title={compact ? t("nearMe") : undefined}
        className={
          compact
            ? "flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-primary hover:border-primary disabled:opacity-60"
            : "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[14px] font-semibold text-ink hover:border-primary disabled:opacity-60"
        }
      >
        <LocateFixed className={state === "busy" ? "size-4 animate-pulse text-primary" : "size-4 text-primary"} aria-hidden="true" />
        {!compact && (state === "busy" ? t("locating") : t("nearMe"))}
      </button>
      {state === "denied" && !compact && <span className="text-[13px] text-muted">{t("locationDenied")}</span>}
    </span>
  );
}
