"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { setPlaceLaundryAction } from "../actions";

/** Staff: one place's laundry — not offered, free, or a price per kg — saved on change. */
export function PlaceLaundrySetting({ listingId, initial }: { listingId: string; initial: number | null }) {
  const t = useTranslations("Laundry");
  const router = useRouter();
  const [mode, setMode] = useState(initial === null ? "off" : initial === 0 ? "free" : "paid");
  const [price, setPrice] = useState(initial && initial > 0 ? String(initial) : "1500");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const save = (nextMode: string, nextPrice: string) =>
    start(async () => {
      setSaved(false);
      const value = nextMode === "off" ? null : nextMode === "free" ? 0 : Math.max(1, Math.round(Number(nextPrice) || 0));
      if (await setPlaceLaundryAction(listingId, value)) {
        setSaved(true);
        router.refresh();
      }
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={t("placeLabel")}
        value={mode}
        disabled={pending}
        onChange={(e) => {
          setMode(e.target.value);
          if (e.target.value !== "paid") save(e.target.value, price);
        }}
        className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-primary"
      >
        <option value="off">{t("placeOff")}</option>
        <option value="free">{t("placeFree")}</option>
        <option value="paid">{t("placePaid")}</option>
      </select>
      {mode === "paid" && (
        <>
          <input
            type="number"
            min={1}
            max={100000}
            inputMode="numeric"
            aria-label={t("placePaid")}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-28 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-primary"
          />
          <button type="button" disabled={pending || !(Number(price) > 0)} onClick={() => save("paid", price)} className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
            {t("admin.savePrice")}
          </button>
        </>
      )}
      {saved && !pending && <Check className="size-4 text-emerald-600" aria-label={t("admin.saved")} />}
    </div>
  );
}
