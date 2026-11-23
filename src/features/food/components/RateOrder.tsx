"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { rateOrderAction } from "../actions";

/** Once the food is delivered: how was it (1–5 stars and a comment)? This finishes the order. */
export function RateOrder({ reference }: { reference: string }) {
  const t = useTranslations("Food.rate");
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-canvas p-4">
      <p className="text-[15px] font-semibold text-ink">{t("title")}</p>
      <div className="flex gap-1" role="radiogroup" aria-label={t("title")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={t("stars", { count: n })} onClick={() => setStars(n)} className="p-1">
            <Star className={cn("size-7", n <= stars ? "fill-amber-400 text-amber-400" : "text-line-strong")} aria-hidden="true" />
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} placeholder={t("comment")} className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] outline-none focus:border-primary" />
      <button
        type="button"
        disabled={pending || stars === 0}
        onClick={() =>
          start(async () => {
            await rateOrderAction(reference, stars, comment);
            router.refresh();
          })
        }
        className="self-end rounded-full bg-primary px-5 py-2 text-[14px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {t("send")}
      </button>
    </div>
  );
}
