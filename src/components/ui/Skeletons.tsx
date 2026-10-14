"use client";

import type { ReactNode } from "react";
import { useResultsPending } from "@/features/search/results-pending";
import { cn } from "@/lib/cn";

const BLOCK = "rounded-2xl bg-line/45 motion-safe:animate-pulse";

/** A card-shaped placeholder: square photo, two text lines. */
function CardSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className={cn(BLOCK, wide ? "aspect-[20/19]" : "aspect-square")} />
      <div className={cn(BLOCK, "h-3.5 w-3/4 rounded-md")} />
      <div className={cn(BLOCK, "h-3 w-1/2 rounded-md")} />
    </div>
  );
}

/** Home rows while a category loads: a title and a row of cards, three times. */
export function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-9" aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex flex-col gap-4">
          <div className={cn(BLOCK, "h-5 w-48 rounded-md")} />
          <div className="grid grid-cols-[46%_46%_8%] gap-3 overflow-hidden md:grid-cols-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <div className="hidden md:block">
              <CardSkeleton />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Results list while filters load: full-width cards on phones, two per row from tablet up. */
export function ListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-8 min-[480px]:grid-cols-2" aria-hidden="true">
      {[0, 1, 2, 3].map((card) => (
        <CardSkeleton key={card} wide />
      ))}
    </div>
  );
}

/** Shows `skeleton` instead of `children` while a filter change is loading. */
export function PendingArea({ skeleton, pending: alsoPending = false, children }: { skeleton: ReactNode; pending?: boolean; children: ReactNode }) {
  const pending = useResultsPending() || alsoPending;
  return (
    <div aria-busy={pending}>
      {pending ? <div className="motion-safe:animate-[fade-in_200ms_ease-out]">{skeleton}</div> : children}
    </div>
  );
}

/** Text that turns into a skeleton bar while results load (titles, counts). */
export function PendingText({ children, className }: { children: ReactNode; className?: string }) {
  const pending = useResultsPending();
  return pending ? <span className={cn(BLOCK, "inline-block h-[0.9em] rounded-md align-middle", className)} aria-hidden="true" /> : <>{children}</>;
}

/** Covers its parent (e.g. the map) with a pulsing skeleton layer while results load. */
export function PendingCover({ pending: alsoPending = false }: { pending?: boolean }) {
  const pending = useResultsPending() || alsoPending;
  if (!pending) return null;
  return (
    <div className="absolute inset-0 z-20 bg-canvas motion-safe:animate-[fade-in_200ms_ease-out]" aria-hidden="true">
      <div className="size-full bg-line/45 motion-safe:animate-pulse" />
    </div>
  );
}
