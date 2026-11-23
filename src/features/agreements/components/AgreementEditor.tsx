"use client";

import { History, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { setAgreementAction } from "../actions";

export type AgreementRow = { id: string; percentBps: number | null; fixedFee: number | null; effectiveFrom: string; note: string | null; by: string };

/**
 * VIIPA's commission with one place, restaurant or laundry, made simple: what applies now, a "Change" button that
 * asks for the new rate (% or a fixed fee in RWF) and from when, and the history of every agreement.
 */
export function AgreementEditor({ subject, subjectId, current, history, fallback }: { subject: "PLACE" | "RESTAURANT" | "LAUNDRY"; subjectId: string; current: string | null; history: AgreementRow[]; fallback: string }) {
  const t = useTranslations("Agreements");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const field = "min-w-0 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-primary";
  const label = (r: { percentBps: number | null; fixedFee: number | null }) => (r.fixedFee !== null ? t("fixed", { amount: r.fixedFee.toLocaleString() }) : `${(r.percentBps ?? 0) / 100}%`);

  const save = () =>
    start(async () => {
      const n = Number(value.replace(",", "."));
      const r = await setAgreementAction(subject, subjectId, { percent: kind === "percent" ? n : null, fixedFee: kind === "fixed" ? Math.round(n) : null, effectiveFrom: from, note });
      setError(!r.ok);
      if (r.ok) {
        setOpen(false);
        setValue("");
        setNote("");
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink">
          <b className="font-semibold">{current ?? fallback}</b>
          {!current && <span className="text-muted"> · {t("noAgreement")}</span>}
        </span>
        <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[12px] font-semibold text-ink hover:border-primary">
          <Pencil className="size-3.5" aria-hidden="true" />
          {t("change")}
        </button>
        {history.length > 0 && (
          <button type="button" onClick={() => setShowHistory(!showHistory)} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold text-primary hover:bg-primary/[0.06]">
            <History className="size-3.5" aria-hidden="true" />
            {t("history", { count: history.length })}
          </button>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-2 rounded-xl bg-canvas p-3">
          <div className="flex flex-wrap items-end gap-2">
            <span className="inline-flex rounded-lg border border-line-strong bg-surface p-0.5">
              {(["percent", "fixed"] as const).map((k) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={cn("rounded-md px-2.5 py-1 text-[12px] font-semibold", kind === k ? "bg-primary text-white" : "text-ink")}>
                  {t(`kind.${k}`)}
                </button>
              ))}
            </span>
            <input className={cn(field, "w-24")} inputMode="decimal" aria-label={t(`kind.${kind}`)} placeholder={kind === "percent" ? "8" : "2000"} value={value} onChange={(e) => setValue(e.target.value)} />
            <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-muted">
              {t("from")}
              <input className={field} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
          </div>
          <input className={field} placeholder={t("note")} aria-label={t("note")} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <p className="text-[12px] font-medium text-danger">{t("invalid")}</p>}
          <button type="button" disabled={pending || !value.trim()} onClick={save} className="self-end rounded-full bg-primary px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50">
            {t("save")}
          </button>
        </div>
      )}
      {showHistory && (
        <ol className="flex flex-col gap-1 rounded-xl bg-canvas px-3 py-2 text-[12px]">
          {history.map((r) => (
            <li key={r.id} className="flex flex-wrap gap-x-2 text-ink">
              <b className="font-semibold">{label(r)}</b>
              <span className="text-muted">{t("fromDate", { date: r.effectiveFrom })}</span>
              <span className="text-muted">· {r.by}</span>
              {r.note && <span className="text-muted">· {r.note}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
