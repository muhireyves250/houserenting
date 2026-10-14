"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { replyTicketAction } from "../actions";

export function ReplyBox({ reference }: { reference: string }) {
  const t = useTranslations("Support");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-0.5 rounded-xl border border-line-strong bg-surface px-4 py-2.5 focus-within:border-ink max-md:focus-within:border-primary">
        <span className="text-xs font-semibold text-muted">{t("reply")}</span>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={3} className="w-full resize-y bg-transparent text-[15px] text-ink outline-none" />
      </label>
      {failed && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {t("sendFailed")}
        </p>
      )}
      <Button
        className="self-end"
        loading={pending}
        disabled={body.trim().length < 2}
        onClick={() =>
          start(async () => {
            const { ok } = await replyTicketAction(reference, body);
            setFailed(!ok);
            if (ok) {
              setBody("");
              router.refresh();
            }
          })
        }
      >
        {t("send")}
      </Button>
    </div>
  );
}
