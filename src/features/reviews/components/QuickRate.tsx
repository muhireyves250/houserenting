"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { submitReviewAction } from "../actions";

/** Rate a stay with stars only, right on its card: tap 1 to 5 and it's sent (no text needed). */
export function QuickRate({ reference }: { reference: string }) {
  const t = useTranslations("Reviews");
  const router = useRouter();
  const [hover, setHover] = useState(0);
  const [given, setGiven] = useState(0);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const shown = given || hover;
  const rate = (n: number) =>
    start(async () => {
      const r = await submitReviewAction(reference, n, "");
      if (r.ok) {
        setGiven(n);
        setFailed(false);
        router.refresh();
      } else setFailed(true);
    });
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-[13px] font-semibold text-ink">{given ? t("thanks") : t("tapToRate")}</span>
      <span role="radiogroup" aria-label={t("rating")} className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={given === n}
            aria-label={t("stars", { count: n })}
            disabled={pending || given > 0}
            onMouseEnter={() => setHover(n)}
            onClick={() => rate(n)}
            className="flex size-9 items-center justify-center rounded-full transition-transform hover:scale-110 disabled:hover:scale-100"
          >
            <Star className={cn("size-6", n <= shown ? "fill-amber-400 text-amber-500" : "text-line-strong")} aria-hidden="true" />
          </button>
        ))}
      </span>
      {failed && <span className="text-[12px] font-medium text-danger">{t("rateFailed")}</span>}
    </div>
  );
}
