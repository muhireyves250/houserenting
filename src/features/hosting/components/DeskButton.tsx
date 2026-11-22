"use client";

import { LogIn, LogOut } from "lucide-react";
import { useState, useTransition } from "react";
import { frontDeskMoveAction } from "@/features/stay/actions";
import { useRouter } from "@/i18n/navigation";

/** Check a guest in (they've arrived and shown their ID) or out, from the place's front desk. */
export function DeskButton({ reference, to, label, failed }: { reference: string; to: "CHECKED_IN" | "COMPLETED"; label: string; failed: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const Icon = to === "CHECKED_IN" ? LogIn : LogOut;
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await frontDeskMoveAction(reference, to);
            setError(!r.ok);
            if (r.ok) router.refresh();
          })
        }
        className={to === "CHECKED_IN" ? "inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50" : "inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-semibold text-ink hover:border-primary disabled:opacity-50"}
      >
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </button>
      {error && <span className="text-[12px] font-medium text-danger">{failed}</span>}
    </span>
  );
}
