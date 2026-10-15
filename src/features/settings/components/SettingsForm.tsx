"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { AreaField, Card, Field } from "@/features/hosting/components/fields";
import { useRouter } from "@/i18n/navigation";
import { updateSettingsAction } from "../actions";
import type { SettingsInput } from "../validation";

const num = (value: string) => (value.trim() === "" ? null : Number(value));
const show = (value: number | null) => (value === null ? "" : String(value));

/** Platform business settings. Blank fields stay "not set": nothing is charged or promised for them. */
export function SettingsForm({ initial, envHoldMinutes }: { initial: SettingsInput; envHoldMinutes: number }) {
  const t = useTranslations("Settings");
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
