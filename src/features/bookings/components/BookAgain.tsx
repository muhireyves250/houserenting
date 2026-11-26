"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";

const look = "absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-primary/[0.08] px-3 py-1.5 text-[12px] font-semibold text-primary hover:bg-primary/15";

/**
 * Book again, at the card's bottom right under its arrow: opens the same stay ready to reserve, or, when it can't
 * be booked now, says so under the card. `children` is the card's link (the button sits over it, not inside it).
 */
export function BookAgain({ href, label, unavailable, children }: { href: string | null; label: string; unavailable: string; children: ReactNode }) {
  const [said, setSaid] = useState(false);
  return (
    <>
      <div className="relative">
        {children}
        {href ? (
          <Link href={href} className={look}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {label}
          </Link>
        ) : (
          <button type="button" onClick={() => setSaid(true)} aria-expanded={said} className={look}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        )}
      </div>
      {said && (
        <p role="status" className="mx-3 mb-3 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {unavailable}
        </p>
      )}
    </>
  );
}
