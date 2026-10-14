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
