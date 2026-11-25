"use client";

import { ChevronRight, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { requestCleaningAction } from "../actions";

/** My stay's two buttons: open the booking's details, and ask for the room to be cleaned (with an optional note). */
export function StayActions({ reference, cleaningAskedAt }: { reference: string; cleaningAskedAt: string | null }) {
  const t = useTranslations("MyStay");
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = () =>
    start(async () => {
      const r = await requestCleaningAction(reference, note);
      if (r.ok) {
        setAsking(false);
        setNote("");
        setError(null);
        router.refresh();
      } else setError(t(`cleaning.error.${r.error}`));
    });
  const button = "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition-[background-color,transform] active:scale-[0.98]";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Link href={`/bookings/${reference}`} className={`${button} bg-primary text-white hover:bg-primary-hover`}>
          {t("bookingDetails")}
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
        <button type="button" disabled={Boolean(cleaningAskedAt)} onClick={() => setAsking((v) => !v)} className={`${button} bg-surface text-ink ring-1 ring-line hover:ring-primary/40 disabled:opacity-60`}>
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          {t("cleaning.button")}
        </button>
      </div>
      {cleaningAskedAt && <p className="rounded-xl bg-emerald-50 px-4 py-2.5 text-[14px] font-medium text-emerald-800">{t("cleaning.waiting", { time: cleaningAskedAt })}</p>}
      {asking && !cleaningAskedAt && (
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3 ring-1 ring-line">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} placeholder={t("cleaning.notePlaceholder")} aria-label={t("cleaning.notePlaceholder")} className="rounded-xl border border-line-strong px-3 py-2 text-[15px] text-ink outline-none focus:border-primary" />
          <button type="button" disabled={pending} onClick={send} className="h-11 rounded-xl bg-primary text-[15px] font-semibold text-white disabled:opacity-50">
            {t("cleaning.send")}
          </button>
          {error && <p className="text-[13px] font-medium text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
