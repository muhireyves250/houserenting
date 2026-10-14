"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { submitReviewAction } from "../actions";

/** Feedback after a stay: 1–5 stars and a few words. Staff check it before it shows on the listing. */
export function ReviewForm({ reference }: { reference: string }) {
  const t = useTranslations("Reviews");
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={t("rating")} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={t("stars", { count: n })}
            onClick={() => setRating(n)}
            className="rounded-full p-1 transition-transform active:scale-90"
          >
            <Star className={cn("size-8", n <= rating ? "fill-amber-400 text-amber-400" : "text-line-strong")} aria-hidden="true" />
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-0.5 rounded-xl border border-line-strong bg-surface px-4 py-2.5 focus-within:border-ink max-md:focus-within:border-primary">
        <span className="text-xs font-semibold text-muted">{t("comment")}</span>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} rows={4} className="w-full resize-y bg-transparent text-[15px] text-ink outline-none" />
      </label>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
      <p className="text-[13px] text-muted">{t("moderationNote")}</p>
      <Button
        size="lg"
        fullWidth
        loading={pending}
        disabled={rating === 0 || comment.trim().length < 10}
        onClick={() =>
          start(async () => {
            const result = await submitReviewAction(reference, rating, comment);
            if (result.ok) router.refresh();
            else setError(t(`error.${result.error}`));
          })
        }
      >
        {t("send")}
      </Button>
    </div>
  );
}
