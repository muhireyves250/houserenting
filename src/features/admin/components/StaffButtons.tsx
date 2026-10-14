"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { setTicketStatusAction } from "@/features/support/actions";
import { moderateQuestionAction, moderateReviewAction, moveBookingAction } from "../moderation-actions";

const small = "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-50";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const run = (action: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      const { ok } = await action();
      setFailed(!ok);
      if (ok) router.refresh();
    });
  return { pending, failed, run };
}

/** Publish / reject buttons for a question or a piece of feedback. */
export function ModerateButtons({ kind, id, canPublish = true }: { kind: "question" | "review"; id: string; canPublish?: boolean }) {
  const t = useTranslations("Admin");
  const { pending, failed, run } = useRun();
  const act = (publish: boolean) => run(() => (kind === "question" ? moderateQuestionAction(id, publish) : moderateReviewAction(id, publish)));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={pending || !canPublish} onClick={() => act(true)} className={cn(small, "bg-primary text-white hover:bg-primary-hover")}>
        {t("publish")}
      </button>
      <button type="button" disabled={pending} onClick={() => act(false)} className={cn(small, "bg-canvas text-danger hover:bg-line/70")}>
        {t("rejectShort")}
      </button>
      {failed && <span className="text-[13px] text-danger">{t("actionFailed")}</span>}
    </div>
  );
}

export function TicketStatusSelect({ reference, status }: { reference: string; status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" }) {
  const t = useTranslations("Support");
  const tAdmin = useTranslations("Admin");
  const { pending, failed, run } = useRun();
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted">
      {tAdmin("status")}
      <select
        value={status}
        disabled={pending || status === "CLOSED"}
        onChange={(e) => run(() => setTicketStatusAction(reference, e.target.value as typeof status))}
        className="cursor-pointer rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-[13px] font-semibold text-ink"
      >
        {(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const).map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </select>
      {failed && <span className="text-danger">{tAdmin("actionFailed")}</span>}
    </label>
  );
}

export function CheckInOut({ reference, to }: { reference: string; to: "CHECKED_IN" | "COMPLETED" }) {
  const t = useTranslations("Admin");
  const { pending, failed, run } = useRun();
  return (
    <span className="flex items-center gap-2">
      <button type="button" disabled={pending} onClick={() => run(() => moveBookingAction(reference, to))} className={cn(small, "bg-primary text-white hover:bg-primary-hover")}>
        {to === "CHECKED_IN" ? t("checkIn") : t("checkOut")}
      </button>
      {failed && <span className="text-[13px] text-danger">{t("actionFailed")}</span>}
    </span>
  );
}
