"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { setRestaurateurAction } from "../actions";

/** Restaurant owner/manager on or off: they set up and run a restaurant from their dashboard. */
export function RestaurateurToggle({ userId, isRestaurateur, places, disabled = false }: { userId: string; isRestaurateur: boolean; places: number; disabled?: boolean }) {
  const t = useTranslations("Admin.restaurateur");
  const router = useRouter();
  const [on, setOn] = useState(isRestaurateur);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const flip = () =>
    start(async () => {
      setError(null);
      const next = !on;
      const r = await setRestaurateurAction(userId, next);
      if (r.ok) {
        setOn(next);
        router.refresh();
      } else setError(t(r.error === "hasRestaurants" ? "hasRestaurants" : "failed", { count: places }));
    });
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-ink">{t("label")}</span>
          <span className="block text-[12px] text-muted">{on ? t("onHint") : t("offHint")}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={t("label")}
          disabled={pending || disabled}
          onClick={flip}
          className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50", on ? "bg-primary" : "bg-line-strong")}
        >
          <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
        </button>
      </div>
      {error && <p className="text-[12px] font-medium text-danger">{error}</p>}
    </div>
  );
}
