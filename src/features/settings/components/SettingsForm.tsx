"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { AreaField, Card, Field, SelectField } from "@/features/hosting/components/fields";
import { useRouter } from "@/i18n/navigation";
import { updateSettingsAction } from "../actions";
import { PLACE_TYPES } from "@/features/search/params";
import type { SettingsInput } from "../validation";

const num = (value: string) => (value.trim() === "" ? null : Number(value));
const show = (value: number | null) => (value === null ? "" : String(value));

/** Platform business settings. Blank fields stay "not set": nothing is charged or promised for them. */
export function SettingsForm({ initial, envHoldMinutes }: { initial: SettingsInput; envHoldMinutes: number }) {
  const t = useTranslations("Settings");
  const tType = useTranslations("ListingType");
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof SettingsInput>(key: K, value: SettingsInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };
  const err = (key: string) => (errors[key] ? t("invalid") : undefined);

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl bg-amber-50 px-5 py-3.5 text-sm text-amber-900 ring-1 ring-amber-200/70">{t("note")}</p>
      <Card title={t("money")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("commission")} type="number" step="0.01" min={0} max={50} value={show(form.commissionPercent ?? null)} onChange={(e) => set("commissionPercent", num(e.target.value))} error={err("commissionPercent")} />
          <Field label={t("guestFee")} type="number" step="0.01" min={0} max={50} value={show(form.guestFeePercent ?? null)} onChange={(e) => set("guestFeePercent", num(e.target.value))} error={err("guestFeePercent")} />
          <Field label={t("deposit")} type="number" min={0} max={1200} value={show(form.monthlyDepositPercent ?? null)} onChange={(e) => set("monthlyDepositPercent", num(e.target.value))} error={err("monthlyDepositPercent")} />
          <Field
            label={t("hold", { minutes: envHoldMinutes })}
            type="number"
            min={5}
            max={1440}
            value={show(form.holdMinutes ?? null)}
            onChange={(e) => set("holdMinutes", num(e.target.value))}
            error={err("holdMinutes")}
          />
        </div>
        <p className="mt-3 text-[13px] text-muted">{t("moneyHint")}</p>
      </Card>
      <Card title={t("monthly")}>
        <Field
          label={t("upfrontMonths")}
          type="number"
          min={1}
          max={24}
          value={show(form.monthlyUpfrontMonths ?? null)}
          onChange={(e) => set("monthlyUpfrontMonths", num(e.target.value))}
          error={err("monthlyUpfrontMonths")}
        />
        <SelectField
          label={t("identity")}
          className="mt-3"
          value={form.monthlyIdentity ?? "NONE"}
          onChange={(e) => set("monthlyIdentity", e.target.value as "NONE" | "ID" | "ID_NATIONALITY")}
        >
          {(["NONE", "ID", "ID_NATIONALITY"] as const).map((option) => (
            <option key={option} value={option}>
              {t(`identityOption.${option}`)}
            </option>
          ))}
        </SelectField>
        <p className="mt-3 text-[13px] text-muted">{t("monthlyHint")}</p>
        <p className="mt-1 text-[13px] text-muted">{t("identityHint")}</p>
      </Card>
      <Card title={t("referrals")}>
        <label className="mb-3 flex cursor-pointer items-center gap-3 text-[15px] text-ink">
          <input
            type="checkbox"
            checked={Boolean(form.referralEnabled)}
            onChange={(e) => set("referralEnabled", e.target.checked)}
            className="size-5 cursor-pointer accent-[var(--color-primary)]"
          />
          {t("referralEnabled")}
        </label>
        <Field
          label={t("referralReward")}
          type="number"
          min={1}
          value={show(form.referralRewardAmount ?? null)}
          onChange={(e) => set("referralRewardAmount", num(e.target.value))}
          error={err("referralRewardAmount")}
        />
        <p className="mt-3 text-[13px] text-muted">{t("referralHint")}</p>
      </Card>
      <Card title={t("paymentTitle")}>
        <AreaField
          label={t("paymentInstructions")}
          rows={3}
          maxLength={500}
          placeholder={t("paymentInstructionsHint")}
          value={form.paymentInstructions ?? ""}
          onChange={(e) => set("paymentInstructions", e.target.value)}
          error={err("paymentInstructions")}
        />
        <p className="mt-2 text-[13px] text-muted">{t("paymentHint")}</p>
      </Card>
      <Card title={t("feesTitle")}>
        <SelectField label={t("feeModel")} value={form.feeModel ?? "ADD_ON"} onChange={(e) => set("feeModel", e.target.value as "ADD_ON" | "INCLUDED")}>
          <option value="ADD_ON">{t("feeModelAddOn")}</option>
          <option value="INCLUDED">{t("feeModelIncluded")}</option>
        </SelectField>
        <p className="mt-2 mb-4 text-[13px] text-muted">{t("feeModelHint")}</p>
        <p className="mb-2 text-[13px] font-semibold text-ink">{t("commissionByType")}</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PLACE_TYPES.map((type) => (
            <Field
              key={type}
              label={tType(type)}
              type="number"
              step="0.01"
              min={0}
              max={50}
              placeholder={show(form.commissionPercent ?? null)}
              value={show(form.commissionByTypePercent?.[type] ?? null)}
              onChange={(e) => set("commissionByTypePercent", { ...form.commissionByTypePercent, [type]: num(e.target.value) })}
              error={err(`commissionByTypePercent.${type}`)}
            />
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted">{t("commissionByTypeHint")}</p>
      </Card>
      <Card title={t("taxTitle")}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("vat")} type="number" step="0.01" min={0} max={50} value={show(form.vatPercent ?? null)} onChange={(e) => set("vatPercent", num(e.target.value))} error={err("vatPercent")} />
          <Field label={t("cit")} type="number" step="0.01" min={0} max={50} value={show(form.citPercent ?? null)} onChange={(e) => set("citPercent", num(e.target.value))} error={err("citPercent")} />
        </div>
        <p className="mt-3 text-[13px] text-muted">{t("taxHint")}</p>
      </Card>
      <Card title={t("promoters")}>
        <label className="mb-3 flex cursor-pointer items-center gap-3 text-[15px] text-ink">
          <input
            type="checkbox"
            checked={Boolean(form.promoterEnabled)}
            onChange={(e) => set("promoterEnabled", e.target.checked)}
            className="size-5 cursor-pointer accent-[var(--color-primary)]"
          />
          {t("promoterEnabled")}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("promoterRewardFixed")}
            type="number"
            min={1}
            value={show(form.promoterRewardFixed ?? null)}
            onChange={(e) => set("promoterRewardFixed", num(e.target.value))}
            error={err("promoterRewardFixed")}
          />
          <Field
            label={t("promoterRewardPercent")}
            type="number"
            min={0}
            step="0.5"
            value={show(form.promoterRewardPercent ?? null)}
            onChange={(e) => set("promoterRewardPercent", num(e.target.value))}
            error={err("promoterRewardPercent")}
          />
        </div>
        <p className="mt-3 text-[13px] text-muted">{t("promoterHint")}</p>
      </Card>
      <Card title={t("feedback")}>
        <Field
          label={t("dislikeHideCount")}
          type="number"
          min={1}
          value={show(form.dislikeHideCount ?? null)}
          onChange={(e) => set("dislikeHideCount", num(e.target.value))}
          error={err("dislikeHideCount")}
        />
        <p className="mt-3 text-[13px] text-muted">{t("dislikeHint")}</p>
      </Card>
      <Card title={t("cancellation")}>
        <p className="-mt-2 mb-3 text-[13px] text-muted">{t("cancellationHint")}</p>
        <div className="grid gap-3">
          {(["en", "fr", "rw"] as const).map((lang) => (
            <AreaField
              key={lang}
              label={t(`lang.${lang}`)}
              rows={4}
              maxLength={4000}
              value={form.cancellationPolicy[lang] ?? ""}
              onChange={(e) => set("cancellationPolicy", { ...form.cancellationPolicy, [lang]: e.target.value || null })}
            />
          ))}
        </div>
      </Card>
      <div className="flex items-center justify-end gap-4">
        {saved && (
          <span role="status" className="inline-flex items-center gap-1.5 text-[13px] text-emerald-700">
            <Check className="size-4" aria-hidden="true" />
            {t("saved")}
          </span>
        )}
        {errors.form && <span className="text-[13px] text-danger">{t("failed")}</span>}
        <Button
          size="lg"
          loading={pending}
          onClick={() =>
            start(async () => {
              const result = await updateSettingsAction(form);
              if (result.ok) {
                setErrors({});
                setSaved(true);
                router.refresh();
              } else setErrors(result.errors);
            })
          }
        >
          {t("save")}
        </Button>
      </div>
    </div>
  );
}
