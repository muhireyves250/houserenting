"use client";

import { FileText, ReceiptText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { DownloadLink } from "@/components/ui/DownloadLink";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { issueInvoiceAction, requestEbmAction } from "../actions";

type Current = { id: string; number: string; stamp: "UNPAID" | "PARTLY_PAID" | "PAID" | "CANCELLED" | "CORRECTED"; companyName: string | null; ebmRequested: boolean } | null;
const TONE = { UNPAID: "bg-red-50 text-red-700", PARTLY_PAID: "bg-amber-50 text-amber-800", PAID: "bg-emerald-50 text-emerald-800", CANCELLED: "bg-canvas text-muted", CORRECTED: "bg-canvas text-muted" };

/**
 * The booking's invoice for the guest: get it as a PDF (UNPAID until paid, then PAID), and the EBM receipt (the company
 * is given when reserving): download it once the place uploads it, or ask for it.
 */
export function ClientInvoice({ reference, current, ebm }: { reference: string; current: Current; /** When the EBM receipt was uploaded (null: not yet). */ ebm: string | null }) {
  const t = useTranslations("Invoice.client");
  const tStamp = useTranslations("Invoice.stamp");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) router.refresh();
      else setError(t("failed"));
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
        {/* The EBM receipt once the place (or VIIPA) uploads it; until then the guest can ask for it. */}
        {ebm ? (
          <DownloadLink href={`/api/v1/bookings/${reference}/ebm`} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-700">
            <ReceiptText className="size-4" aria-hidden="true" />
            {t("ebmDownload")}
          </DownloadLink>
        ) : current?.ebmRequested ? (
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-900">{t("ebmRequested")}</span>
        ) : (
          <button type="button" disabled={pending} onClick={() => run(() => requestEbmAction(reference))} className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:border-primary disabled:opacity-50">
            {t("ebm")}
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-[13px] font-medium text-danger">{error}</p>}
    </div>
  );
}
