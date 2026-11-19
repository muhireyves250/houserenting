"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { AreaField, Field } from "@/features/hosting/components/fields";
import { useRouter } from "@/i18n/navigation";
import { saveReceiptAction } from "../actions";
import type { ReceiptDetails } from "../validation";

type Form = { businessName: string; address: string; phone: string; email: string; tin: string; footer: string };

/** Staff edit what guests' receipts show, with a live preview of the receipt's top and bottom. */
export function ReceiptForm({ initial }: { initial: ReceiptDetails }) {
  const t = useTranslations("Receipt");
  const router = useRouter();
  const [form, setForm] = useState<Form>({
    businessName: initial.businessName ?? "",
    address: initial.address ?? "",
    phone: initial.phone ?? "",
    email: initial.email ?? "",
    tin: initial.tin ?? "",
    footer: initial.footer ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saved" | "failed">("idle");
  const [pending, start] = useTransition();
  const set = (key: keyof Form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setStatus("idle");
  };
  const save = () =>
    start(async () => {
      const result = await saveReceiptAction(form);
      if (result.ok) {
        setErrors({});
        setStatus("saved");
        router.refresh();
      } else {
        setErrors("errors" in result ? result.errors : {});
        setStatus("failed");
      }
    });

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
        <h2 className="text-[16px] font-bold text-ink">{t("title")}</h2>
        <p className="-mt-1 text-[13px] text-muted">{t("intro")}</p>
        <Field label={t("businessName")} placeholder="VIIPA" value={form.businessName} maxLength={80} onChange={(e) => set("businessName", e.target.value)} />
        <Field label={t("address")} placeholder={t("addressHint")} value={form.address} maxLength={160} onChange={(e) => set("address", e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("phone")} placeholder="+250 7…" value={form.phone} maxLength={40} onChange={(e) => set("phone", e.target.value)} />
          <Field label={t("email")} type="email" value={form.email} maxLength={120} onChange={(e) => set("email", e.target.value)} error={errors.email ? t("emailError") : undefined} />
        </div>
        <Field label={t("tin")} placeholder="1234…" value={form.tin} maxLength={40} onChange={(e) => set("tin", e.target.value)} />
        <AreaField label={t("footer")} placeholder={t("footerHint")} rows={3} maxLength={300} value={form.footer} onChange={(e) => set("footer", e.target.value)} />
        <div className="flex items-center justify-end gap-3 pt-1">
          {status === "saved" && (
            <span role="status" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
              <Check className="size-4" aria-hidden="true" />
              {t("saved")}
            </span>
          )}
          {status === "failed" && (
            <span role="alert" className="text-[13px] font-medium text-danger">
              {t("failed")}
            </span>
          )}
          <button type="button" onClick={save} disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-hover disabled:opacity-60">
            {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
            {t("save")}
          </button>
        </div>
      </section>

      {/* How a guest's receipt will look (top and bottom). */}
      <section aria-label={t("preview")} className="rounded-2xl bg-surface p-5 ring-1 ring-line lg:sticky lg:top-24">
        <p className="mb-3 text-[12px] font-semibold tracking-wide text-muted uppercase">{t("preview")}</p>
        <ReceiptHeader details={{ ...form, businessName: form.businessName || null, address: form.address || null, phone: form.phone || null, email: form.email || null, tin: form.tin || null, footer: form.footer || null }} tinLabel={t("tinShort")} />
        <div className="my-3 flex flex-col gap-1.5 border-y border-dashed border-line py-3 text-[13px] text-muted">
          <span className="flex justify-between">
            <span>{t("sampleLine")}</span>
            <span className="tabular-nums">RWF 90,000</span>
          </span>
          <span className="flex justify-between font-semibold text-ink">
            <span>{t("sampleTotal")}</span>
            <span className="tabular-nums">RWF 94,500</span>
          </span>
        </div>
        {form.footer ? <p className="text-center text-[12px] whitespace-pre-line text-muted">{form.footer}</p> : <p className="text-center text-[12px] text-muted/60 italic">{t("noFooter")}</p>}
      </section>
    </div>
  );
}

/** The business block at the top of a receipt (shared by the preview and guests' receipts). */
export function ReceiptHeader({ details, tinLabel }: { details: ReceiptDetails; tinLabel: string }) {
  const lines = [details.address, [details.phone, details.email].filter(Boolean).join(" · "), details.tin ? `${tinLabel} ${details.tin}` : null].filter(Boolean);
  return (
    <div className="text-center">
      <p className="text-[16px] font-bold text-ink">{details.businessName || "VIIPA"}</p>
      {lines.map((line) => (
        <p key={line} className="text-[12px] text-muted">
          {line}
        </p>
      ))}
    </div>
  );
}
