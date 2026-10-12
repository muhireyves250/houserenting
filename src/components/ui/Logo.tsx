import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 56" fill="none" stroke="currentColor" strokeWidth={5} className={className} aria-hidden="true">
      <path d="M4 28 32 6l28 22" strokeLinejoin="miter" />
      <path d="M14 23v29h14v-9" />
      <path d="M23 26v12h18" />
      <path d="M41 26v26h9V23" />
    </svg>
  );
}

export function Logo({
  withWordmark = false,
  className,
  wordmarkClassName,
}: {
  withWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-primary", className)}>
      <LogoMark className="h-7 w-8" />
      {withWordmark ? (
        <span className={cn("text-lg font-bold tracking-tight text-ink", wordmarkClassName)}>Space Rental</span>
      ) : (
        <span className="sr-only">Space Rental</span>
      )}
    </span>
  );
}
