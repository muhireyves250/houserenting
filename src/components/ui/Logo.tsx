import Image from "next/image";
import { cn } from "@/lib/cn";

/** VIIPA's V mark (transparent PNG, 512×235). Size it with a height class, e.g. "h-8 w-auto". */
export function LogoMark({ className, priority = false }: { className?: string; priority?: boolean }) {
  return <Image src="/brand/viipa-mark.png" alt="" width={512} height={235} priority={priority} className={cn("h-8 w-auto select-none", className)} draggable={false} />;
}

/** The "VIIPA" lettering exactly as on the logo (transparent PNG, 990×172). Size it with a height class; on dark
 * backgrounds add "brightness-0 invert" for a white version. */
export function LogoWordmark({ className, priority = false }: { className?: string; priority?: boolean }) {
  return <Image src="/brand/viipa-wordmark.png" alt="VIIPA" width={990} height={172} priority={priority} className={cn("h-4 w-auto select-none", className)} draggable={false} />;
}

/** The full VIIPA logo with "Care That Connects." (1000×704), for light backgrounds. */
export function FullLogo({ className, priority = false, decorative = false }: { className?: string; priority?: boolean; decorative?: boolean }) {
  return (
    <Image src="/brand/viipa-logo.png" alt={decorative ? "" : "VIIPA — Care That Connects."} width={1000} height={704} priority={priority} className={cn("h-24 w-auto select-none", className)} draggable={false} />
  );
}

/**
 * The mark with the site name for screen readers (or shown, with `withWordmark`). `tile` puts the mark on a
 * white rounded tile so it stays visible on dark or blue backgrounds.
 */
export function Logo({
  withWordmark = false,
  tile = false,
  className,
  markClassName,
  wordmarkClassName,
}: {
  withWordmark?: boolean;
  tile?: boolean;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className={cn("inline-flex items-center", tile && "rounded-xl bg-white px-2 py-1.5 shadow-sm")}>
        <LogoMark className={markClassName} priority />
      </span>
      {withWordmark ? (
        <LogoWordmark className={cn("h-[18px]", wordmarkClassName)} priority />
      ) : (
        <span className="sr-only">VIIPA</span>
      )}
    </span>
  );
}
