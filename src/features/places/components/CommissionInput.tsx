"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { setPlaceCommissionAction } from "../actions";

/** VIIPA's commission on one place, in %: type a rate and save; empty goes back to the category's rate. */
export function CommissionInput({ listingId, value, placeholder }: { listingId: string; value: number | null; placeholder: number }) {
  const t = useTranslations("Money.commission");
  const router = useRouter();
  const [text, setText] = useState(value === null ? "" : String(value));
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  const changed = text.trim() !== (value === null ? "" : String(value));

  const save = () =>
    start(async () => {
      const raw = text.trim().replace(",", ".");
      const percent = raw === "" ? null : Number(raw);
      if (percent !== null && (!Number.isFinite(percent) || percent < 0 || percent > 50)) return setState("error");
      const { ok } = await setPlaceCommissionAction(listingId, percent);
      setState(ok ? "saved" : "error");
      if (ok) router.refresh();
    });

  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center rounded-lg border border-line-strong bg-surface pr-2 focus-within:border-primary">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setState("idle");
          }}
          onKeyDown={(e) => e.key === "Enter" && changed && save()}
          inputMode="decimal"
          placeholder={String(placeholder)}
          aria-label={t("label")}
          className="w-14 bg-transparent px-2 py-1.5 text-right text-[13px] font-semibold text-ink outline-none tabular-nums"
        />
        <span className="text-[13px] text-muted">%</span>
      </span>
      {changed ? (
        <button type="button" disabled={pending} onClick={save} className="rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
          {t("save")}
        </button>
      ) : state === "saved" ? (
        <Check className="size-4 text-emerald-600" aria-label={t("saved")} />
      ) : null}
      {state === "error" && <span className="text-[12px] text-danger">{t("error")}</span>}
    </span>
  );
}
