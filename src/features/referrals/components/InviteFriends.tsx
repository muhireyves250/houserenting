"use client";

import { Check, Copy, Gift } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { formatRWF } from "@/lib/format";

/** Profile card: the person's invite link, how many friends joined, and rewards (when the platform pays them). */
export function InviteFriends({ link, code, invited, earned, reward }: { link: string; code: string; invited: number; earned: number; reward: number | null }) {
  const t = useTranslations("Referrals");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  return (
    <section className="mt-6 rounded-3xl bg-surface p-6 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] max-md:ring-line">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/[0.08] text-primary">
          <Gift className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">{t("title")}</h2>
          <p className="text-[13px] text-muted">{reward ? t("bodyReward", { amount: formatRWF(reward, locale) }) : t("body")}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-line-strong px-4 py-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{link}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(link);
            setCopied(true);
          }}
          aria-label={t("copy")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-ink hover:bg-line/70"
        >
          {copied ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        </button>
      </div>
      <p className="mt-3 text-[13px] text-muted">
        {t("code", { code })} · {t("invited", { count: invited })}
        {earned > 0 && ` · ${t("earned", { amount: formatRWF(earned, locale) })}`}
      </p>
    </section>
  );
}
