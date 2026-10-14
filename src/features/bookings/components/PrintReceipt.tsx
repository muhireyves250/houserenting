"use client";

import { Printer } from "lucide-react";

export function PrintReceipt({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-canvas px-3.5 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:bg-line/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary print:hidden"
    >
      <Printer className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
