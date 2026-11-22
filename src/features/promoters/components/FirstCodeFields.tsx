"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/features/hosting/components/fields";

export type FirstCode = { code: string; percentOff: string; sharePercent: string };
export const EMPTY_CODE: FirstCode = { code: "", percentOff: "", sharePercent: "" };
export const toFirstCode = (c: FirstCode) => ({ code: c.code, percentOff: Number(c.percentOff) || 0, sharePercent: Number(c.sharePercent.replace(",", ".")) || 0 });

/** The promoter's own promo code: the code clients type, the discount they get, and the promoter's share. */
export function FirstCodeFields({ value, onChange, errors = {} }: { value: FirstCode; onChange: (c: FirstCode) => void; errors?: Record<string, string> }) {
  const t = useTranslations("Promoters.firstCode");
  const err = (k: "code" | "percentOff" | "sharePercent") => (errors[k] ? t(errors[k] === "taken" ? "error.taken" : `error.${k}`) : undefined);
  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-3">
      <legend className="px-1 text-[13px] font-semibold text-ink">{t("title")}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("code")} value={value.code} maxLength={30} onChange={(e) => onChange({ ...value, code: e.target.value.toUpperCase() })} error={err("code")} />
        <Field label={t("percentOff")} type="number" min={1} max={100} value={value.percentOff} onChange={(e) => onChange({ ...value, percentOff: e.target.value })} error={err("percentOff")} />
        <Field label={t("share")} inputMode="decimal" value={value.sharePercent} onChange={(e) => onChange({ ...value, sharePercent: e.target.value })} error={err("sharePercent")} />
      </div>
      <p className="text-[12px] text-muted">{t("hint")}</p>
    </fieldset>
  );
}
