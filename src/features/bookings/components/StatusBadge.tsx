import { cn } from "@/lib/cn";
import { STATUS_TONE } from "../format";
import type { BookingStatus } from "../status";

export function StatusBadge({ status, label, className }: { status: BookingStatus; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", STATUS_TONE[status], className)}>
      {label}
    </span>
  );
}
