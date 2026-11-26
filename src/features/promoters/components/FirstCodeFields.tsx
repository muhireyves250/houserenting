"use client";

import { useTranslations } from "next-intl";
import { Field } from "@/features/hosting/components/fields";

export type FirstCode = { code: string; percentOff: string; sharePercent: string; startsOn: string; endsOn: string };
export const EMPTY_CODE: FirstCode = { code: "", percentOff: "", sharePercent: "", startsOn: "", endsOn: "" };
export const toFirstCode = (c: FirstCode) => ({ code: c.code, percentOff: Number(c.percentOff) || 0, sharePercent: Number(c.sharePercent.replace(",", ".")) || 0, startsOn: c.startsOn, endsOn: c.endsOn });
/** Field names a code form reports errors for. */
export const CODE_FIELDS = ["code", "percentOff", "sharePercent", "startsOn", "endsOn"];

/**
 * The promoter's promo code: the code clients type, the discount they get, the promoter's share, and from when until
 * when it works (for a new promoter, also their own period: after it they are ended and can apply again).
 */
export function FirstCodeFields({ value, onChange, errors = {}, periodHint }: { value: FirstCode; onChange: (c: FirstCode) => void; errors?: Record<string, string>; periodHint?: string }) {
  const t = useTranslations("Promoters.firstCode");
  const err = (k: "code" | "percentOff" | "sharePercent" | "startsOn" | "endsOn") => {
    const e = errors[k];
    if (!e) return undefined;
    if (e === "taken") return t("error.taken");
    if (k === "endsOn" && (e === "endBeforeStart" || e === "past" || e === "afterPromoter")) return t(`error.${e}`);
    return t(`error.${k}`);
  };
  return (
    <fieldset className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] p-3">
      <legend className="px-1 text-[13px] font-semibold text-ink">{t("title")}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t("code")} value={value.code} maxLength={30} onChange={(e) => onChange({ ...value, code: e.target.value.toUpperCase() })} error={err("code")} />
        <Field label={t("percentOff")} type="number" min={1} max={100} value={value.percentOff} onChange={(e) => onChange({ ...value, percentOff: e.target.value })} error={err("percentOff")} />
        <Field label={t("share")} inputMode="decimal" value={value.sharePercent} onChange={(e) => onChange({ ...value, sharePercent: e.target.value })} error={err("sharePercent")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("startsOn")} type="date" value={value.startsOn} onChange={(e) => onChange({ ...value, startsOn: e.target.value })} error={err("startsOn")} />
        <Field label={t("endsOn")} type="date" min={value.startsOn || undefined} value={value.endsOn} onChange={(e) => onChange({ ...value, endsOn: e.target.value })} error={err("endsOn")} />
      </div>
      <p className="text-[12px] text-muted">{t("hint")}</p>
      {periodHint && <p className="text-[12px] font-medium text-ink/80">{periodHint}</p>}
    </fieldset>
  );
}
