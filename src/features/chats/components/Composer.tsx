"use client";

import { LoaderCircle, SendHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { sendMessageAction } from "../actions";

/** Message box pinned at the bottom of a chat. Enter sends; Shift+Enter adds a line. New messages appear by themselves. */
export function Composer({ conversationId }: { conversationId: string }) {
  const t = useTranslations("Chats");
  const router = useRouter();
  const [body, setBody] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);

  // Check for new messages every few seconds while the chat is open (and the tab visible).
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [router]);

  function send() {
    const text = body.trim();
    if (!text || pending) return;
    start(async () => {
      const { ok } = await sendMessageAction(conversationId, text);
      setFailed(!ok);
      if (ok) {
        setBody("");
        router.refresh();
        area.current?.focus();
      }
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className="sticky bottom-[calc(8px+env(safe-area-inset-bottom))] z-20 mt-4 md:bottom-4">
      {failed && (
        <p role="alert" className="mb-1 text-center text-[13px] font-medium text-danger">
          {t("sendFailed")}
        </p>
      )}
      <div className="flex items-end gap-2 rounded-3xl border border-line bg-surface/95 p-2 shadow-[0_10px_30px_-12px_rgba(16,24,40,0.35)] backdrop-blur">
        <textarea
          ref={area}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={2000}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-ink outline-none [field-sizing:content]"
        />
        <button
          type="button"
          onClick={send}
          disabled={!body.trim() || pending}
          aria-label={t("send")}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-[0_6px_14px_-6px_rgba(0,87,184,0.85)] transition-[transform,opacity] duration-300 active:scale-90",
            "disabled:opacity-40",
          )}
        >
          {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <SendHorizontal className="size-5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
