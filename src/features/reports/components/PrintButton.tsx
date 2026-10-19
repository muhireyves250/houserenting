"use client";

import { Printer } from "lucide-react";

/** Opens the browser's print window (choose "Save as PDF" there). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" onClick={() => window.print()} data-print-hide className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink hover:border-primary">
      <Printer className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
