"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Link } from "@/i18n/navigation";
import { reportIssueAction } from "../actions";

const input = "w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink outline-none focus:border-primary";

/** Something wrong during the stay: becomes a support request our team answers. */
export function ReportIssue({ reference }: { reference: string }) {
  const t = useTranslations("MyStay");
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ticket, setTicket] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  if (ticket)
    return (
      <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-[14px] text-emerald-900">
        {t("issueSent")}{" "}
        <Link href={`/support/${ticket}`} className="font-semibold underline">
          {t("issueFollow", { reference: ticket })}
        </Link>
      </p>
    );
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start rounded-full border border-line bg-surface px-5 py-2.5 text-[14px] font-semibold text-ink hover:border-primary">
        {t("reportIssue")}
      </button>
    );
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        {t("issueSubject")}
        <input className={input} maxLength={120} value={subject} placeholder={t("issueSubjectHint")} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        {t("issueBody")}
        <textarea className={input} rows={3} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {t("issueError")}
        </p>
      )}
      <button
        type="button"
        disabled={pending || subject.trim().length < 3 || body.trim().length < 2}
        onClick={() =>
          start(async () => {
            const result = await reportIssueAction(reference, subject, body);
            if ("reference" in result) setTicket(result.reference);
            else setError(true);
          })
        }
        className="self-end rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {t("sendIssue")}
      </button>
    </div>
  );
}
