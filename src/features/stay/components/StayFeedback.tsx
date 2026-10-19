"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { feedbackAction } from "../actions";

/** Like or dislike the stay, with an optional note. Can be changed later. */
export function StayFeedback({ reference, initial }: { reference: string; initial: { liked: boolean; comment: string | null } | null }) {
  const t = useTranslations("MyStay");
  const router = useRouter();
  const [liked, setLiked] = useState<boolean | null>(initial?.liked ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const choose = (value: boolean) => {
    setLiked(value);
    setSaved(false);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {[true, false].map((value) => {
          const Icon = value ? ThumbsUp : ThumbsDown;
          return (
            <button
              key={String(value)}
              type="button"
              aria-pressed={liked === value}
              onClick={() => choose(value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[14px] font-semibold transition-colors",
                liked === value ? (value ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-danger bg-red-50 text-danger") : "border-line text-ink hover:border-primary/60",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {value ? t("like") : t("dislike")}
            </button>
          );
        })}
      </div>
      {liked !== null && (
        <>
          <textarea
            rows={2}
            maxLength={500}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setSaved(false);
            }}
            placeholder={liked ? t("likeNote") : t("dislikeNote")}
            className="w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus:border-primary"
          />
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-[13px] text-emerald-700">{t("feedbackThanks")}</span>}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const { ok } = await feedbackAction(reference, liked, comment);
                  setSaved(ok);
                  if (ok) router.refresh();
                })
              }
              className="rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            >
              {t("sendFeedback")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
