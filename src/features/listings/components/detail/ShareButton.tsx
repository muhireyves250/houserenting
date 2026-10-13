"use client";

import { Check, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Native share sheet where there is one (phones); otherwise copies the page link. */
export function ShareButton({ title }: { title: string }) {
  const t = useTranslations("Listings");
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
      } catch {
        // Dismissed: nothing to do.
      }
      return;
    }
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={t("share")}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink underline underline-offset-4 transition-colors hover:bg-canvas"
    >
      {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Share className="size-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? t("linkCopied") : t("share")}</span>
    </button>
  );
}
