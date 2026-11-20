"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { setPromoShareAction } from "../money-actions";

/** The promoter's share (%) of each booking with this code: type it and save. */
export function PromoShareInput({
  promoId,
  value,
}: {
  promoId: string;
  value: number | null;
}) {
  const t = useTranslations("Promotions");
  const router = useRouter();
  const [text, setText] = useState(value === null ? "" : String(value));
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  const changed = text.trim() !== (value === null ? "" : String(value));
  const save = () =>
    start(async () => {
      const raw = text.trim().replace(",", ".");
      const percent = raw === "" ? null : Number(raw);
      if (
        percent !== null &&
        (!Number.isFinite(percent) || percent < 0 || percent > 50)
      )
        return setState("error");
      const { ok } = await setPromoShareAction(promoId, percent);
      setState(ok ? "saved" : "error");
      if (ok) router.refresh();
    });
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] font-semibold text-muted">
        {t("promoterPercent")}
      </span>
      <span className="flex items-center rounded-lg border border-line-strong bg-surface pr-2 focus-within:border-primary">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setState("idle");
          }}
          onKeyDown={(e) => e.key === "Enter" && changed && save()}
          onBlur={() => changed && !pending && save()}
          inputMode="decimal"
          placeholder="5"
          aria-label={t("promoterPercent")}
          className="w-14 bg-transparent px-2 py-1.5 text-right text-[13px] font-semibold text-ink outline-none tabular-nums"
        />
        <span className="text-[13px] text-muted">%</span>
      </span>
      {changed ? (
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {t("saveShare")}
        </button>
      ) : pending ? null : state === "saved" ? (
        <Check className="size-4 text-emerald-600" aria-label="OK" />
      ) : null}
      {state === "error" && (
        <span className="text-[12px] text-danger">0–50%</span>
      )}
    </span>
  );
}
