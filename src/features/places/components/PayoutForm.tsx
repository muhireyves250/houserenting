"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Field, SelectField } from "@/features/hosting/components/fields";
import { useRouter } from "@/i18n/navigation";
import { savePayoutAction } from "../actions";
import type { PayoutInput } from "../payout-service";

/** Where the owner is paid. Saving sends it to staff to verify (needed before places go live). */
export function PayoutForm({ initial }: { initial: PayoutInput | null }) {
  const t = useTranslations("Places");
  const router = useRouter();
  const [form, setForm] = useState<PayoutInput>(initial ?? { method: "MOBILE_MONEY", accountName: "", accountNumber: "", bankName: null });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = <K extends keyof PayoutInput>(k: K, v: PayoutInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };
  return (
    <div className="flex flex-col gap-3">
      <SelectField label={t("payoutMethod")} value={form.method} onChange={(e) => set("method", e.target.value as PayoutInput["method"])}>
        <option value="MOBILE_MONEY">{t("payoutMomo")}</option>
        <option value="BANK">{t("payoutBank")}</option>
      </SelectField>
      <Field label={t("accountName")} value={form.accountName} maxLength={100} onChange={(e) => set("accountName", e.target.value)} error={errors.accountName ? t("checkField") : undefined} />
      <Field
        label={form.method === "BANK" ? t("accountNumber") : t("momoNumber")}
        value={form.accountNumber}
        maxLength={40}
        inputMode={form.method === "BANK" ? "text" : "tel"}
        onChange={(e) => set("accountNumber", e.target.value)}
        error={errors.accountNumber ? t("checkField") : undefined}
      />
      {form.method === "BANK" && (
        <Field label={t("bankName")} value={form.bankName ?? ""} maxLength={80} onChange={(e) => set("bankName", e.target.value)} error={errors.bankName ? t("checkField") : undefined} />
      )}
      <p className="text-[13px] text-muted">{t("payoutPrivate")}</p>
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-[13px] text-emerald-700">{t("payoutSaved")}</span>}
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              const result = await savePayoutAction(form);
              if (result.ok) {
                setErrors({});
                setSaved(true);
                router.refresh();
              } else setErrors(result.errors);
            })
          }
        >
          {t("savePayout")}
        </Button>
      </div>
    </div>
  );
}
