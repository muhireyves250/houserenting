"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { appealEarlyCheckoutAction } from "../actions";

/** The guest disagrees with being checked out early: they write why; VIIPA and the place are told. */
export function EarlyCheckoutAppeal({ reference }: { reference: string }) {
  const t = useTranslations("MyStay.early");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start rounded-full bg-surface px-4 py-2 text-[14px] font-semibold text-red-800 ring-1 ring-red-200 hover:bg-red-50">
        {t("appeal")}
      </button>
    );
  return (
    <div className="flex flex-col gap-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={3} placeholder={t("appealPlaceholder")} aria-label={t("appealPlaceholder")} className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] outline-none focus:border-primary" />
      <button
        type="button"
        disabled={pending || text.trim().length < 5}
        onClick={() =>
          start(async () => {
            const r = await appealEarlyCheckoutAction(reference, text);
            setFailed(!r.ok);
            if (r.ok) router.refresh();
          })
        }
        className="self-start rounded-full bg-primary px-4 py-2 text-[14px] font-semibold text-white disabled:opacity-50"
      >
        {t("send")}
      </button>
      {failed && <p className="text-[13px] font-medium text-danger">{t("failed")}</p>}
    </div>
  );
}
