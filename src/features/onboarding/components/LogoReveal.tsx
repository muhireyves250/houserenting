import { cn } from "@/lib/cn";

const PATHS = ["M4 28 32 6l28 22", "M14 23v29h14v-9", "M23 26v12h18", "M41 26v26h9V23"];

/** Full-screen brand intro: the house logo draws itself stroke by stroke, then "Space Rental" rises in. */
export function LogoReveal({ leaving = false, className, testId }: { leaving?: boolean; className?: string; testId?: string }) {
  return (
    <div
      data-testid={testId}
      data-leaving={leaving}
      aria-hidden="true"
      className={cn("welcome-splash fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-surface to-primary-soft", className)}
    >
      <svg viewBox="0 0 64 56" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="square" className="welcome-logo h-20 w-[92px] text-primary">
        {PATHS.map((d, i) => (
          <path key={d} d={d} pathLength={1} style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </svg>
      <p className="welcome-name text-2xl font-bold tracking-[-0.02em] text-primary">Space Rental</p>
    </div>
  );
}
