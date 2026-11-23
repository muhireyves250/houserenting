"use client";

import { Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { DownloadLink } from "@/components/ui/DownloadLink";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { cancelInvoiceAction, correctInvoiceAction, issueInvoiceAction } from "../actions";

type Line = { description: string; quantity: number; unitPrice: number };
export type StaffInvoice = {
  id: string;
  number: string;
  version: number;
  state: "ISSUED" | "CANCELLED" | "CORRECTED";
  stamp: "UNPAID" | "PARTLY_PAID" | "PAID" | "CANCELLED" | "CORRECTED";
  createdAt: string;
  note: string | null;
  ebmRequested: boolean;
  billTo: { billToName: string; billToEmail: string | null; billToPhone: string | null; companyName: string | null; companyTin: string | null; contactPerson: string | null; address: string | null; extraInfo: string | null };
  lines: Line[];
  total: number;
};
const TONE = { UNPAID: "bg-red-50 text-red-700", PARTLY_PAID: "bg-amber-50 text-amber-800", PAID: "bg-emerald-50 text-emerald-800", CANCELLED: "bg-canvas text-muted", CORRECTED: "bg-canvas text-muted" };

/** Staff: the booking's invoices, every version kept. Issue, download, correct (a new version) or cancel, each with a reason. */
export function StaffInvoices({ reference, invoices }: { reference: string; invoices: StaffInvoice[] }) {
  const t = useTranslations("Invoice.staff");
  const tStamp = useTranslations("Invoice.stamp");
  const tClient = useTranslations("Invoice.client");
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<StaffInvoice | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const field = "min-w-0 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] outline-none focus:border-primary";
  const after = (r: { ok: boolean }) => {
    if (r.ok) {
      setEditing(null);
      setCancelling(null);
      setReason("");
      setError(null);
      router.refresh();
    } else setError(t("failed"));
  };

  return (
    <div className="flex flex-col gap-3">
      {invoices.length === 0 && (
        <button type="button" disabled={pending} onClick={() => start(async () => after(await issueInvoiceAction(reference)))} className="self-start rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
          {t("issue")}
        </button>
      )}
      <ul className="flex flex-col gap-2">
        {invoices.map((inv) => (
          <li key={inv.id} className={cn("flex flex-col gap-2 rounded-xl px-3 py-2.5 ring-1 ring-line", inv.state !== "ISSUED" && "opacity-70")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] font-semibold text-ink">{inv.number}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", TONE[inv.stamp])}>{tStamp(inv.stamp)}</span>
              {inv.ebmRequested && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">EBM</span>}
              <span className="ml-auto text-[12px] text-muted">{inv.createdAt}</span>
            </div>
            <p className="text-[12px] text-muted">
              {inv.billTo.companyName ? `${inv.billTo.companyName} · ` : ""}
              {inv.billTo.billToName}
              {inv.note ? ` · ${inv.note}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <DownloadLink href={`/api/v1/invoices/${inv.id}?lang=${locale}`} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-ink hover:border-primary">
                PDF
              </DownloadLink>
              {inv.state === "ISSUED" && (
                <>
                  <button type="button" onClick={() => setEditing(editing?.id === inv.id ? null : inv)} className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-ink hover:border-primary">
                    {t("correct")}
                  </button>
                  <button type="button" onClick={() => setCancelling(cancelling === inv.id ? null : inv.id)} className="rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-danger hover:border-danger">
                    {t("cancel")}
                  </button>
                </>
              )}
            </div>
            {cancelling === inv.id && (
              <div className="flex gap-2">
                <input className={cn(field, "flex-1")} placeholder={t("reason")} aria-label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
                <button type="button" disabled={pending || !reason.trim()} onClick={() => start(async () => after(await cancelInvoiceAction(inv.id, reason)))} className="rounded-full bg-danger px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">
                  {t("cancelConfirm")}
                </button>
              </div>
            )}
            {editing?.id === inv.id && (
              <div className="flex flex-col gap-2 rounded-xl bg-canvas p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["billToName", t("billToName")],
                      ["billToEmail", tClient("email")],
                      ["companyName", tClient("companyName")],
                      ["companyTin", tClient("companyTin")],
                      ["contactPerson", tClient("contactPerson")],
                      ["address", tClient("address")],
                    ] as const
                  ).map(([k, label]) => (
                    <input key={k} className={field} placeholder={label} aria-label={label} value={editing.billTo[k] ?? ""} onChange={(e) => setEditing({ ...editing, billTo: { ...editing.billTo, [k]: e.target.value } })} />
                  ))}
                </div>
                <p className="text-[12px] font-semibold text-ink">{t("lines")}</p>
                {editing.lines.map((l, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_70px_110px_auto] gap-2">
                    <input className={field} aria-label={t("description")} value={l.description} onChange={(e) => setEditing({ ...editing, lines: editing.lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
                    <input className={field} type="number" min={1} aria-label={t("qty")} value={l.quantity} onChange={(e) => setEditing({ ...editing, lines: editing.lines.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) || 1 } : x)) })} />
                    <input className={field} type="number" aria-label={t("unitPrice")} value={l.unitPrice} onChange={(e) => setEditing({ ...editing, lines: editing.lines.map((x, j) => (j === i ? { ...x, unitPrice: Number(e.target.value) || 0 } : x)) })} />
                    <button type="button" aria-label={t("removeLine")} onClick={() => setEditing({ ...editing, lines: editing.lines.filter((_, j) => j !== i) })} className="flex size-9 items-center justify-center rounded-full text-danger hover:bg-danger/5">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setEditing({ ...editing, lines: [...editing.lines, { description: "", quantity: 1, unitPrice: 0 }] })} className="inline-flex items-center gap-1 self-start text-[12px] font-semibold text-primary">
                  <Plus className="size-3.5" aria-hidden="true" />
                  {t("addLine")}
                </button>
                <input className={field} placeholder={t("reason")} aria-label={t("reason")} value={reason} onChange={(e) => setReason(e.target.value)} />
                <p className="text-[12px] text-muted">{t("correctHint")}</p>
                <button
                  type="button"
                  disabled={pending || !reason.trim()}
                  onClick={() => start(async () => after(await correctInvoiceAction(inv.id, editing.billTo, editing.lines, reason)))}
                  className="self-end rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  {t("saveCorrection")}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-[13px] font-medium text-danger">{error}</p>}
    </div>
  );
}
