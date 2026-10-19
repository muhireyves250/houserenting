"use client";

import { BadgeCheck, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";

/** Upload the guest's ID before arrival, when the place asks for it online. */
export function GuestIdUpload({ reference, uploaded }: { reference: string; uploaded: string | null }) {
  const t = useTranslations("MyStay");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/v1/bookings/${reference}/guest-id`, { method: "POST", body }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const code = ((await res?.json().catch(() => null)) as { error?: string } | null)?.error;
      setError(code === "tooLarge" ? t("idTooLarge") : code === "badType" ? t("idBadType") : t("idFailed"));
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {uploaded ? (
        <p className="inline-flex items-center gap-2 text-[14px] font-semibold text-emerald-700">
          <BadgeCheck className="size-5" aria-hidden="true" />
          {t("idUploaded")}
          <a href={`/api/v1/bookings/${reference}/guest-id`} target="_blank" rel="noopener" className="font-normal text-primary underline">
            {uploaded}
          </a>
        </p>
      ) : (
        <p className="text-[14px] text-muted">{t("idAsked")}</p>
      )}
      <label className="inline-flex cursor-pointer items-center gap-2 self-start rounded-full border border-line bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink hover:border-primary">
        <Upload className="size-4" aria-hidden="true" />
        {busy ? t("idUploading") : uploaded ? t("idReplace") : t("idUpload")}
        <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => void upload(e.target.files?.[0])} />
      </label>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
