"use client";

import { Building2, FileText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { DownloadLink } from "@/components/ui/DownloadLink";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { billToInvoiceAction, issueInvoiceAction, requestEbmAction } from "../actions";

type Current = { id: string; number: string; stamp: "UNPAID" | "PARTLY_PAID" | "PAID" | "CANCELLED" | "CORRECTED"; companyName: string | null; ebmRequested: boolean } | null;
const TONE = { UNPAID: "bg-red-50 text-red-700", PARTLY_PAID: "bg-amber-50 text-amber-800", PAID: "bg-emerald-50 text-emerald-800", CANCELLED: "bg-canvas text-muted", CORRECTED: "bg-canvas text-muted" };

/**
 * The booking's invoice for the guest: get it as a PDF (UNPAID until paid, then PAID), ask for it in a company's name
 * (name, TIN, contact person, address, email), and ask for an EBM invoice.
 */
export function ClientInvoice({ reference, current, guest }: { reference: string; current: Current; guest: { name: string; email: string } }) {
  const t = useTranslations("Invoice.client");
  const tStamp = useTranslations("Invoice.stamp");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [company, setCompany] = useState(false);
  const [form, setForm] = useState({ companyName: current?.companyName ?? "", companyTin: "", contactPerson: guest.name, address: "", billToEmail: guest.email, extraInfo: "" });
  const [error, setError] = useState<string | null>(null);
  const field = "min-w-0 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] outline-none focus:border-primary";

  const run = (fn: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        setCompany(false);
        router.refresh();
      } else setError(t("failed"));
    });

  return (
    <div className="flex flex-col gap-3">
      {current ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-canvas px-4 py-3">
          <FileText className="size-5 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[14px] font-semibold text-ink">{current.number}</span>
            {current.companyName && <span className="block truncate text-[12px] text-muted">{current.companyName}</span>}
          </span>
          <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-bold", TONE[current.stamp])}>{tStamp(current.stamp)}</span>
          <DownloadLink href={`/api/v1/invoices/${current.id}?lang=${locale}`} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-hover">
            {t("download")}
          </DownloadLink>
        </div>
      ) : (
        <button type="button" disabled={pending} onClick={() => run(() => issueInvoiceAction(reference))} className="inline-flex items-center gap-2 self-start rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
          <FileText className="size-4" aria-hidden="true" />
          {t("get")}
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCompany(!company)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:border-primary">
          <Building2 className="size-4" aria-hidden="true" />
          {t("company")}
        </button>
        {current && !current.ebmRequested && (
          <button type="button" disabled={pending} onClick={() => run(() => requestEbmAction(reference))} className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:border-primary disabled:opacity-50">
            {t("ebm")}
          </button>
        )}
        {current?.ebmRequested && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-800">{t("ebmRequested")}</span>}
      </div>
      {company && (
        <div className="grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-2">
          <input className={field} placeholder={t("companyName")} aria-label={t("companyName")} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
          <input className={field} placeholder={t("companyTin")} aria-label={t("companyTin")} value={form.companyTin} onChange={(e) => setForm({ ...form, companyTin: e.target.value })} />
          <input className={field} placeholder={t("contactPerson")} aria-label={t("contactPerson")} value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
          <input className={field} type="email" placeholder={t("email")} aria-label={t("email")} value={form.billToEmail} onChange={(e) => setForm({ ...form, billToEmail: e.target.value })} />
          <input className={cn(field, "sm:col-span-2")} placeholder={t("address")} aria-label={t("address")} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <textarea className={cn(field, "sm:col-span-2")} rows={2} placeholder={t("extra")} aria-label={t("extra")} value={form.extraInfo} onChange={(e) => setForm({ ...form, extraInfo: e.target.value })} />
          <button
            type="button"
            disabled={pending || form.companyName.trim().length < 2}
            onClick={() => run(() => billToInvoiceAction(reference, { billToName: form.contactPerson || guest.name, billToEmail: form.billToEmail, companyName: form.companyName, companyTin: form.companyTin, contactPerson: form.contactPerson, address: form.address, extraInfo: form.extraInfo }))}
            className="rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50 sm:col-span-2 sm:justify-self-end"
          >
            {t("companySave")}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-[13px] font-medium text-danger">{error}</p>}
    </div>
  );
}
