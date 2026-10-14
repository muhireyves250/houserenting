import { cn } from "@/lib/cn";

const TONE: Record<string, string> = {
  OPEN: "bg-amber-50 text-amber-800 ring-amber-200",
  IN_PROGRESS: "bg-primary/[0.08] text-primary ring-primary/20",
  RESOLVED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CLOSED: "bg-canvas text-muted ring-line",
};

export function TicketStatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", TONE[status])}>{label}</span>;
}
