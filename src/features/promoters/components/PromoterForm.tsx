"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { AreaField, Field, SelectField } from "@/features/hosting/components/fields";
import { useRouter } from "@/i18n/navigation";
import { savePromoterAction } from "../actions";
import type { PromoterInput } from "../service";

/** Apply as a promoter, or update where rewards are paid. */
export function PromoterForm({ initial, applying }: { initial: PromoterInput; applying: boolean }) {
  const t = useTranslations("Promoters");
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof PromoterInput>(k: K, v: PromoterInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };
  const err = (k: string) => (errors[k] ? t("checkField") : undefined);
  return (
    <div className="flex flex-col gap-3">
      {applying && <AreaField label={t("about")} rows={3} maxLength={500} value={form.about ?? ""} placeholder={t("aboutHint")} onChange={(e) => set("about", e.target.value)} />}
      <SelectField label={t("payoutMethod")} value={form.payoutMethod} onChange={(e) => set("payoutMethod", e.target.value as PromoterInput["payoutMethod"])}>
        <option value="MOBILE_MONEY">{t("momo")}</option>
        <option value="BANK">{t("bank")}</option>
      </SelectField>
      <Field label={t("payoutName")} value={form.payoutName} maxLength={100} onChange={(e) => set("payoutName", e.target.value)} error={err("payoutName")} />
      <Field label={form.payoutMethod === "BANK" ? t("accountNumber") : t("momoNumber")} value={form.payoutNumber} maxLength={40} onChange={(e) => set("payoutNumber", e.target.value)} error={err("payoutNumber")} />
      {form.payoutMethod === "BANK" && <Field label={t("bankName")} value={form.bankName ?? ""} maxLength={80} onChange={(e) => set("bankName", e.target.value || null)} error={err("bankName")} />}
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-[13px] text-emerald-700">{applying ? t("applied") : t("saved")}</span>}
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const result = await savePromoterAction(form);
              if (result.ok) {
                setErrors({});
                setSaved(true);
                router.refresh();
              } else setErrors(result.errors);
            })
          }
        >
          {applying ? t("apply") : t("save")}
        </Button>
      </div>
    </div>
  );
}
