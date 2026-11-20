"use client";

import { Check, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { sendReceiptToChatAction } from "../actions";

/** Sends this payment's receipt (PDF) to the client's chat; then links to that chat. */
export function SendReceiptButton({ paymentId }: { paymentId: string }) {
  const t = useTranslations("Money.receipt");
  const [sent, setSent] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  if (sent)
    return (
      <Link
        href={`/admin/messages/${sent}`}
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-800 hover:underline"
      >
        <Check className="size-3.5" aria-hidden="true" />
        {t("sent")}
      </Link>
    );
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await sendReceiptToChatAction(paymentId);
          if (r.ok) setSent(r.conversationId);
          else setFailed(true);
        })
      }
      className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-[12px] font-semibold text-ink hover:border-primary hover:text-primary disabled:opacity-50"
    >
      <Send className="size-3.5" aria-hidden="true" />
      {failed ? t("sendFailed") : pending ? t("sending") : t("send")}
    </button>
  );
}
