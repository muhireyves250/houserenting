import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

export function Stars({ rating, label, className }: { rating: number; label: string; className?: string }) {
  return (
    <span role="img" aria-label={label} className={cn("inline-flex gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-3.5", n <= rating ? "fill-ink text-ink" : "text-line-strong")} aria-hidden="true" />
      ))}
    </span>
  );
}
