import { FullLogo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";

/** Full-screen brand intro: the VIIPA logo rises in, then the splash fades away. */
export function LogoReveal({ leaving = false, className, testId }: { leaving?: boolean; className?: string; testId?: string }) {
  return (
    <div
      data-testid={testId}
      data-leaving={leaving}
      aria-hidden="true"
      className={cn("welcome-splash fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-surface to-primary-soft", className)}
    >
      <FullLogo decorative priority className="welcome-mark h-40 md:h-52" />
    </div>
  );
}
