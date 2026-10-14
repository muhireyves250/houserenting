"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Link, usePathname } from "@/i18n/navigation";
import { askQuestionAction } from "../actions";

/** "Ask the host" box under a listing's answered questions. */
export function AskQuestion({ listingId, signedIn }: { listingId: string; signedIn: boolean }) {
  const t = useTranslations("Questions");
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (!signedIn) {
    return (
      <Link href={{ pathname: "/login", query: { next: pathname } }} className="inline-flex text-[15px] font-semibold text-primary underline-offset-4 hover:underline">
        {t("loginToAsk")}
      </Link>
    );
  }

  function send() {
    start(async () => {
      const result = await askQuestionAction(listingId, text);
      if (result.ok) {
        setText("");
        setMessage({ ok: true, text: t("sent") });
      } else {
        setMessage({ ok: false, text: t(`error.${result.error}`) });
      }
    });
  }

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <label className="flex flex-col gap-0.5 rounded-xl border border-line-strong bg-surface px-4 py-2.5 focus-within:border-ink max-md:focus-within:border-primary">
        <span className="text-xs font-semibold text-muted">{t("askLabel")}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={3} className="w-full resize-y bg-transparent text-[15px] text-ink outline-none" />
      </label>
      <div className="flex items-center justify-between gap-4">
        <p role="status" className={message?.ok === false ? "text-[13px] font-medium text-danger" : "text-[13px] text-muted"}>
          {message?.text ?? t("moderationNote")}
        </p>
        <Button onClick={send} loading={pending} disabled={text.trim().length < 5}>
          {t("ask")}
        </Button>
      </div>
    </div>
  );
}
