import { FileText } from "lucide-react";
import { DownloadLink } from "@/components/ui/DownloadLink";
import { cn } from "@/lib/cn";

/** A receipt sent in a chat: tap to download the PDF. */
export function ReceiptCard({
  paymentId,
  label,
  hint,
  mine,
  locale,
}: {
  paymentId: string;
  label: string;
  hint: string;
  mine: boolean;
  locale: string;
}) {
  return (
    <DownloadLink
      icon={false}
      href={`/api/v1/receipts/${paymentId}?lang=${locale}`}
      className={cn(
        "mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 no-underline transition-colors",
        mine
          ? "bg-white/15 text-white hover:bg-white/25"
          : "bg-canvas text-ink ring-1 ring-line hover:ring-primary",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          mine ? "bg-white/20" : "bg-red-50 text-red-700",
        )}
      >
        <FileText className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold">
          {label}
        </span>
        <span
          className={cn(
            "block text-[12px]",
            mine ? "text-white/75" : "text-muted",
          )}
        >
          {hint}
        </span>
      </span>
    </DownloadLink>
  );
}
