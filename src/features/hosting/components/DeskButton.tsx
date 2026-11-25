"use client";

import { LogIn, LogOut } from "lucide-react";
import { useState, useTransition } from "react";
import { frontDeskMoveAction } from "@/features/stay/actions";
import { useRouter } from "@/i18n/navigation";

/**
 * Check a guest in (they've arrived and shown their ID) or out, from the place's front desk. Checking out before the
 * stay's end (`early`) first asks why: the guest is told and reads it.
 */
export function DeskButton({ reference, to, label, failed, early }: { reference: string; to: "CHECKED_IN" | "COMPLETED"; label: string; failed: string; early?: { question: string; confirm: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const go = (why = "") =>
    start(async () => {
      const r = await frontDeskMoveAction(reference, to, why);
      setError(!r.ok);
      if (r.ok) {
        setAsking(false);
        router.refresh();
      }
    });
  const Icon = to === "CHECKED_IN" ? LogIn : LogOut;
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => (early ? setAsking((v) => !v) : go())}
        className={to === "CHECKED_IN" ? "inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50" : "inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:border-primary disabled:opacity-50"}
      >
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </button>
      {asking && early && (
        <span className="flex w-64 max-w-full flex-col gap-1.5">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={early.question} aria-label={early.question} className="rounded-lg border border-line-strong px-2.5 py-1.5 text-[13px] outline-none focus:border-primary" />
          <button type="button" disabled={pending || reason.trim().length < 3} onClick={() => go(reason)} className="rounded-full bg-danger px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50">
            {early.confirm}
          </button>
        </span>
      )}
      {error && <span className="text-[12px] font-medium text-danger">{failed}</span>}
    </span>
  );
}
