import { cn } from "@/lib/cn";

const BLOCK = "bg-line/45 motion-safe:animate-pulse";

/**
 * Shown the moment a link is tapped, while the next page loads: on phones the blue top with a title bar, then
 * cards; on computers a title and cards. Server-safe (no client code), so it appears instantly.
 */
export function PageSkeleton({ variant = "page" }: { variant?: "page" | "listing" | "admin" | "home" }) {
  if (variant === "home") {
    return (
      <div aria-busy="true" aria-hidden="true">
        {/* The blue search top, then rows of places. */}
        <div className="flex h-[300px] flex-col items-center justify-center gap-4 bg-gradient-to-b from-primary/80 to-primary/40 px-4">
          <div className="h-10 w-72 max-w-full rounded-full bg-white/70" />
          <div className="h-14 w-[560px] max-w-full rounded-full bg-white/85" />
        </div>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-9 px-4 py-8 md:px-6">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex flex-col gap-4">
              <div className={cn(BLOCK, "h-5 w-48 rounded-md")} />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className={cn("flex flex-col gap-2.5", i > 1 && "max-md:hidden")}>
                    <div className={cn(BLOCK, "aspect-[20/19] rounded-2xl")} />
                    <div className={cn(BLOCK, "h-3.5 w-3/4 rounded-md")} />
                    <div className={cn(BLOCK, "h-3 w-1/2 rounded-md")} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (variant === "listing") {
    return (
      <div className="mx-auto w-full max-w-7xl md:px-6 md:py-6" aria-busy="true" aria-hidden="true">
        <div className={cn(BLOCK, "aspect-[4/3] w-full md:aspect-[21/9] md:rounded-3xl")} />
        <div className="flex flex-col gap-3 px-4 py-6 md:px-0">
          <div className={cn(BLOCK, "h-7 w-3/4 rounded-lg")} />
          <div className={cn(BLOCK, "h-4 w-1/2 rounded-md")} />
          <div className={cn(BLOCK, "mt-4 h-24 w-full rounded-2xl")} />
          <div className={cn(BLOCK, "h-24 w-full rounded-2xl")} />
        </div>
      </div>
    );
  }
  if (variant === "admin") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-hidden="true">
        <div className={cn(BLOCK, "h-5 w-80 max-w-full rounded-md")} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={cn(BLOCK, "h-24 rounded-2xl")} />
          ))}
        </div>
        <div className={cn(BLOCK, "h-72 rounded-2xl")} />
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-10 md:px-6 md:py-10" aria-busy="true" aria-hidden="true">
      {/* Phones: the blue top every page opens with. */}
      <div className="-mx-4 mb-4 flex flex-col items-center bg-gradient-to-b from-primary via-primary/45 to-canvas px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-6 md:hidden">
        <div className="size-11 self-start rounded-full bg-white/80" />
        <div className="mt-2 size-14 rounded-full bg-white/80" />
        <div className="mt-3 h-7 w-40 rounded-lg bg-white/60" />
      </div>
      <div className={cn(BLOCK, "mb-6 hidden h-9 w-56 rounded-lg md:block")} />
      <div className="flex flex-col gap-4">
        <div className={cn(BLOCK, "h-40 rounded-3xl")} />
        <div className={cn(BLOCK, "h-24 rounded-3xl")} />
        <div className={cn(BLOCK, "h-24 rounded-3xl")} />
      </div>
    </div>
  );
}
