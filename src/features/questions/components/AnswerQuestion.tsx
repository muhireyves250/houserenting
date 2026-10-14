"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { answerQuestionAction } from "../actions";

export function AnswerQuestion({ questionId }: { questionId: string }) {
  const t = useTranslations("Questions");
  const router = useRouter();
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="mt-3 flex flex-col gap-2">
      <label className="flex flex-col gap-0.5 rounded-xl border border-line-strong bg-surface px-4 py-2.5 focus-within:border-ink max-md:focus-within:border-primary">
        <span className="text-xs font-semibold text-muted">{t("answerLabel")}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} rows={2} className="w-full resize-y bg-transparent text-[15px] text-ink outline-none" />
      </label>
      {failed && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {t("answerFailed")}
        </p>
      )}
      <Button
        className="self-end"
        loading={pending}
        disabled={!text.trim()}
        onClick={() =>
          start(async () => {
            const { ok } = await answerQuestionAction(questionId, text);
            setFailed(!ok);
            if (ok) router.refresh();
          })
        }
      >
        {t("answer")}
      </Button>
    </div>
  );
}
