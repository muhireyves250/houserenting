"use client";

import { Download, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { DownloadLink } from "@/components/ui/DownloadLink";
import { useRouter } from "@/i18n/navigation";

/** VIIPA or the place's team: upload (or replace) a booking's EBM receipt, and download the one there is. */
export function EbmUpload({ reference, uploadedAt, compact = false }: { reference: string; uploadedAt: string | null; compact?: boolean }) {
  const t = useTranslations("Invoice.ebmUpload");
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(chosen: File | undefined) {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", chosen);
    const res = await fetch(`/api/v1/bookings/${reference}/ebm`, { method: "POST", body }).catch(() => null);
    setBusy(false);
    if (file.current) file.current.value = "";
    if (!res?.ok) {
      const code = ((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "failed";
      setError(t(`error.${["tooLarge", "badType", "notAllowed"].includes(code) ? code : "failed"}` as "error.failed"));
      return;
    }
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!compact && <span className="text-[13px] font-semibold text-ink">{t("title")}</span>}
      {uploadedAt ? (
        <>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[12px] font-semibold text-emerald-800">{t("uploaded", { when: uploadedAt })}</span>
          <DownloadLink href={`/api/v1/bookings/${reference}/ebm`} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold text-primary ring-1 ring-primary/30 hover:bg-primary/5">
            <Download className="size-3.5" aria-hidden="true" />
            {t("download")}
          </DownloadLink>
        </>
      ) : (
        <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] font-semibold text-amber-900">{t("missing")}</span>
      )}
      <label className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-hover">
        <Upload className="size-3.5" aria-hidden="true" />
        {busy ? t("uploading") : uploadedAt ? t("replace") : t("upload")}
        <input ref={file} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} />
      </label>
      {error && <span className="text-[12px] font-medium text-danger">{error}</span>}
    </div>
  );
}
