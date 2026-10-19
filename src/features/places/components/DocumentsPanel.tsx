"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { deleteDocumentAction } from "../actions";

type Doc = { id: string; kind: string; filename: string; size: number; createdAt: Date };
const KINDS = ["OWNER_ID", "OWNERSHIP_PROOF", "MANAGEMENT_AUTHORIZATION", "OTHER"] as const;

/** Private paperwork for a place: only its owner and staff can open it. PDF or photo, up to 8 MB. */
export function DocumentsPanel({ listingId, documents }: { listingId: string; documents: Doc[] }) {
  const t = useTranslations("Places");
  const locale = useLocale();
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("OWNER_ID");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  async function upload(chosen: File | undefined) {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("kind", kind);
    body.append("file", chosen);
    const res = await fetch(`/api/v1/listings/${listingId}/documents`, { method: "POST", body }).catch(() => null);
    setBusy(false);
    if (file.current) file.current.value = "";
    if (!res?.ok) {
      const code = ((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "failed";
      setError(t(`docError.${["tooLarge", "badType"].includes(code) ? code : "failed"}` as "docError.failed"));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">{t("documentsPrivate")}</p>
      {documents.length > 0 && (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="size-5 shrink-0 text-primary" aria-hidden="true" />
              <a href={`/api/v1/documents/${d.id}`} target="_blank" rel="noopener" className="min-w-0 flex-1 text-[14px] text-ink hover:text-primary">
                <span className="block truncate font-medium">{d.filename}</span>
                <span className="block text-xs text-muted">
                  {t(`docKind.${d.kind}` as "docKind.OTHER")} · {Math.ceil(d.size / 1024)} KB · {date.format(d.createdAt)}
                </span>
              </a>
              <button
                type="button"
                disabled={pending}
                aria-label={t("deleteDocument", { name: d.filename })}
                onClick={() =>
                  start(async () => {
                    await deleteDocumentAction(d.id);
                    router.refresh();
                  })
                }
                className="flex size-8 items-center justify-center rounded-full text-danger hover:bg-danger/5"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])} aria-label={t("docKindLabel")} className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px]">
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`docKind.${k}`)}
            </option>
          ))}
        </select>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink hover:border-primary">
          <Upload className="size-4" aria-hidden="true" />
          {busy ? t("uploading") : t("uploadDocument")}
          <input ref={file} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
