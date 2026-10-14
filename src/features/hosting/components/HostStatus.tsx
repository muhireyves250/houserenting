import { cn } from "@/lib/cn";

const TONE: Record<string, string> = {
  DRAFT: "bg-canvas text-ink/80 ring-line",
  PENDING_REVIEW: "bg-amber-50 text-amber-800 ring-amber-200",
  PUBLISHED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  REJECTED: "bg-red-50 text-red-800 ring-red-200",
  ARCHIVED: "bg-canvas text-muted ring-line",
};

export function HostStatus({ status, label, className }: { status: string; label: string; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", TONE[status], className)}>{label}</span>;
}
