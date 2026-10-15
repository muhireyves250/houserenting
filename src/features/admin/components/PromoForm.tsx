"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { AreaField, Card, Field, SelectField } from "@/features/hosting/components/fields";
import { useRouter } from "@/i18n/navigation";
import { createPromoAction, setPromoActiveAction } from "../money-actions";

const num = (v: string) => (v.trim() === "" ? null : Number(v));

export function PromoForm() {
  const t = useTranslations("Promotions");
  const router = useRouter();
  const [form, setForm] = useState({ code: "", description: "", percentOff: "", amountOff: "", minSubtotal: "", startsAt: "", endsAt: "", maxUses: "", fundedBy: "PLATFORM" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const err = (key: string) => (errors[key] ? t(`error.${errors[key] === "taken" ? "taken" : errors[key] === "needsDiscount" ? "needsDiscount" : "field"}`) : undefined);

  return (
    <Card title={t("new")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("code")} value={form.code} maxLength={30} onChange={(e) => set("code", e.target.value.toUpperCase())} error={err("code")} />
        <SelectField label={t("fundedBy")} value={form.fundedBy} onChange={(e) => set("fundedBy", e.target.value)}>
          <option value="PLATFORM">{t("funding.PLATFORM")}</option>
          <option value="HOST">{t("funding.HOST")}</option>
        </SelectField>
        <Field label={t("percentOff")} type="number" min={1} max={100} value={form.percentOff} onChange={(e) => set("percentOff", e.target.value)} error={err("percentOff")} />
        <Field label={t("amountOff")} type="number" min={1} value={form.amountOff} onChange={(e) => set("amountOff", e.target.value)} error={err("amountOff")} />
        <Field label={t("minSubtotal")} type="number" min={1} value={form.minSubtotal} onChange={(e) => set("minSubtotal", e.target.value)} error={err("minSubtotal")} />
        <Field label={t("maxUses")} type="number" min={1} value={form.maxUses} onChange={(e) => set("maxUses", e.target.value)} error={err("maxUses")} />
        <Field label={t("startsAt")} type="date" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} error={err("startsAt")} />
        <Field label={t("endsAt")} type="date" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} error={err("endsAt")} />
        <AreaField label={t("description")} className="sm:col-span-2" rows={2} maxLength={200} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          loading={pending}
          disabled={!form.code.trim()}
          onClick={() =>
            start(async () => {
              const result = await createPromoAction({
                code: form.code,
                description: form.description,
                percentOff: num(form.percentOff),
                amountOff: num(form.amountOff),
                minSubtotal: num(form.minSubtotal),
                maxUses: num(form.maxUses),
                startsAt: form.startsAt ? new Date(`${form.startsAt}T00:00:00+02:00`) : null,
                endsAt: form.endsAt ? new Date(`${form.endsAt}T23:59:59+02:00`) : null,
                fundedBy: form.fundedBy as "PLATFORM" | "HOST",
              });
              if (result.ok) {
                setErrors({});
                setForm({ code: "", description: "", percentOff: "", amountOff: "", minSubtotal: "", startsAt: "", endsAt: "", maxUses: "", fundedBy: "PLATFORM" });
                router.refresh();
              } else setErrors(result.errors);
            })
          }
        >
          {t("create")}
        </Button>
      </div>
    </Card>
  );
}

export function PromoToggle({ id, active }: { id: string; active: boolean }) {
  const t = useTranslations("Promotions");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setPromoActiveAction(id, !active);
          router.refresh();
        })
      }
      className="rounded-lg bg-canvas px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:bg-line/70 disabled:opacity-50"
    >
      {active ? t("disable") : t("enable")}
    </button>
  );
}
