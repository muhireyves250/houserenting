import type { LucideIcon } from "lucide-react";
import { PageHero } from "@/components/shell/PageHero";
import { PageContainer } from "@/components/ui/PageContainer";
import { cn } from "@/lib/cn";

const BLOCK = "bg-line/45 motion-safe:animate-pulse";
const CARD = "rounded-3xl bg-surface p-4 ring-1 ring-line";

export type LoadingShape = "bookings" | "orders" | "list" | "grid" | "form" | "menu" | "stay" | "profile";

/**
 * A page's own loading screen: its real top (title and icon, on phones the blue top) and grey shapes where its
 * content will be, shown the first time the page opens while its data loads.
 */
export function PageLoading({ title, icon, shape, wide = false }: { title: string; icon: LucideIcon; shape: LoadingShape; wide?: boolean }) {
  return (
    <PageContainer className={cn("pb-10 max-md:pt-0 md:py-10", wide ? "max-w-6xl" : "max-w-2xl")} aria-busy="true">
      <PageHero title={title} icon={icon} />
      <h1 className="mb-6 text-[26px] leading-8 font-bold tracking-[-0.03em] text-ink max-md:hidden md:text-[32px] md:leading-10">{title}</h1>
      <div aria-hidden="true">
        <Body shape={shape} />
      </div>
    </PageContainer>
  );
}

function Line({ className }: { className?: string }) {
  return <div className={cn(BLOCK, "h-3.5 rounded-md", className)} />;
}

function Row() {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <div className={cn(BLOCK, "size-12 shrink-0 rounded-2xl")} />
      <div className="flex flex-1 flex-col gap-2">
        <Line className="w-2/3" />
        <Line className="h-3 w-1/3" />
      </div>
    </div>
  );
}

function Tile() {
  return (
    <div className={cn(CARD, "flex gap-4 p-3")}>
      <div className={cn(BLOCK, "size-24 shrink-0 rounded-2xl")} />
      <div className="flex flex-1 flex-col gap-2 py-1">
        <Line className="h-5 w-20 rounded-full" />
        <Line className="w-3/4" />
        <Line className="h-3 w-1/2" />
        <Line className="h-3 w-2/5" />
      </div>
    </div>
  );
}

function Body({ shape }: { shape: LoadingShape }) {
  switch (shape) {
    case "bookings":
      return (
        <div className="flex flex-col gap-4">
          <Line className="h-5 w-24" />
          <div className={cn(BLOCK, "h-44 rounded-3xl")} />
          <div className={cn(BLOCK, "h-11 w-64 rounded-full")} />
          <Tile />
          <Tile />
        </div>
      );
    case "orders":
      return (
        <div className="flex flex-col gap-4">
          <div className={cn(BLOCK, "h-[72px] rounded-3xl")} />
          <Line className="h-5 w-32" />
          <div className={cn(CARD, "divide-y divide-line py-1")}>
            <Row />
            <Row />
            <Row />
          </div>
        </div>
      );
    case "list":
      return (
        <div className={cn(CARD, "divide-y divide-line py-1")}>
          <Row />
          <Row />
          <Row />
          <Row />
          <Row />
        </div>
      );
    case "grid":
      return (
        <div className="grid grid-cols-1 gap-6 min-[480px]:grid-cols-2 md:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col gap-2.5">
              <div className={cn(BLOCK, "aspect-[20/19] rounded-2xl")} />
              <Line className="w-3/4" />
              <Line className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      );
    case "form":
      return (
        <div className={cn(CARD, "flex flex-col gap-4 p-6")}>
          <Line className="h-5 w-32" />
          <div className={cn(BLOCK, "h-14 rounded-2xl")} />
          <div className={cn(BLOCK, "h-14 rounded-2xl")} />
          <div className={cn(BLOCK, "h-32 rounded-2xl")} />
          <div className={cn(BLOCK, "h-12 rounded-full")} />
        </div>
      );
    case "menu":
      return (
        <div className="flex flex-col gap-5">
          <div className={cn(BLOCK, "h-11 rounded-full")} />
          <div className="flex gap-2 overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={cn(BLOCK, "h-8 w-24 shrink-0 rounded-full")} />
            ))}
          </div>
          <Line className="h-5 w-28" />
          <div className="grid gap-3 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn(CARD, "flex gap-3 p-3")}>
                <div className="flex flex-1 flex-col gap-2 py-1">
                  <Line className="w-2/3" />
                  <Line className="h-3 w-full" />
                  <Line className="mt-auto w-20" />
                </div>
                <div className={cn(BLOCK, "size-24 shrink-0 rounded-xl")} />
              </div>
            ))}
          </div>
        </div>
      );
    case "stay":
      return (
        <div className="flex flex-col gap-4">
          <div className={cn(BLOCK, "h-24 rounded-3xl")} />
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={cn(BLOCK, "h-16 rounded-2xl")} />
            ))}
          </div>
          <div className={cn(BLOCK, "h-56 rounded-3xl")} />
          <div className={cn(BLOCK, "h-28 rounded-3xl")} />
        </div>
      );
    case "profile":
      return (
        <div className="divide-y divide-line/70">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 py-4">
              <div className={cn(BLOCK, "size-6 rounded-md")} />
              <Line className="w-40" />
            </div>
          ))}
        </div>
      );
  }
}
