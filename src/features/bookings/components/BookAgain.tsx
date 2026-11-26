"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link } from "@/i18n/navigation";

const look = "inline-flex items-center gap-1.5 rounded-full bg-primary/[0.08] px-3.5 py-2 text-[13px] font-semibold text-primary hover:bg-primary/15";

/** Book again: opens the same stay ready to reserve, or, when it can't be booked now, says so. */
export function BookAgain({ href, label, unavailable }: { href: string | null; label: string; unavailable: string }) {
  const [said, setSaid] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1.5 border-t border-line px-3 py-2">
      {href ? (
        <Link href={href} className={look}>
          <RotateCcw className="size-4" aria-hidden="true" />
          {label}
        </Link>
      ) : (
        <button type="button" onClick={() => setSaid(true)} aria-expanded={said} className={look}>
          <RotateCcw className="size-4" aria-hidden="true" />
          {label}
        </button>
      )}
      {said && (
        <p role="status" className="flex items-start gap-1.5 self-stretch rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {unavailable}
        </p>
      )}
    </div>
  );
}
