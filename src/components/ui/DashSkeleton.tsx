import { cn } from "@/lib/cn";

const B = "bg-line/45 motion-safe:animate-pulse";
const PANEL = "rounded-2xl border border-line bg-surface";

export type DashShape = "overview" | "list" | "cards" | "detail" | "form" | "chat" | "tabsList" | "tabsCards" | "tabsPanels" | "split";

function Line({ className }: { className?: string }) {
  return <div className={cn(B, "h-3.5 rounded-md", className)} />;
}

function Tiles({ count = 4 }: { count?: number }) {
  return (
    <div className={cn("grid gap-3", count === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3")}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn(PANEL, "flex flex-col gap-2 p-4")}>
          <Line className="h-6 w-16" />
          <Line className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

function Rows({ count = 7 }: { count?: number }) {
  return (
    <div className={cn(PANEL, "divide-y divide-line overflow-hidden")}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <div className={cn(B, "size-12 shrink-0 rounded-xl")} />
          <div className="flex flex-1 flex-col gap-2">
            <Line className="w-1/2" />
            <Line className="h-3 w-1/3" />
          </div>
          <div className={cn(B, "hidden h-8 w-20 rounded-full sm:block")} />
        </div>
      ))}
    </div>
  );
}

function Cards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn(PANEL, "flex flex-col gap-3 p-4")}>
          <div className="flex items-center justify-between gap-3">
            <Line className="h-5 w-32" />
            <div className={cn(B, "h-6 w-20 rounded-full")} />
          </div>
          <Line className="w-3/4" />
          <Line className="h-3 w-1/2" />
          <div className="flex gap-2 border-t border-line pt-3">
            <div className={cn(B, "h-8 w-24 rounded-full")} />
            <div className={cn(B, "h-8 w-24 rounded-full")} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Tabs() {
  return (
    <div className={cn(PANEL, "flex gap-2 rounded-full p-1.5")}>
      <div className="h-10 flex-1 rounded-full bg-primary/80" />
      <div className={cn(B, "h-10 flex-1 rounded-full")} />
      <div className={cn(B, "h-10 flex-1 rounded-full")} />
    </div>
  );
}

function Toolbar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(B, "h-8 w-20 rounded-full")} />
        ))}
      </div>
      <div className="h-9 w-36 rounded-full bg-primary/70" />
    </div>
  );
}

function Panel({ lines = 5, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn(PANEL, "flex flex-col gap-3 p-5", className)}>
      <Line className="h-4 w-36" />
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 border-t border-line pt-3">
          <Line className="h-3 w-24" />
          <Line className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

function Form() {
  return (
    <div className={cn(PANEL, "flex flex-col gap-4 p-5")}>
      <Line className="h-4 w-40" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={cn(B, "h-14 rounded-2xl")} />
        ))}
      </div>
      <div className={cn(B, "h-28 rounded-2xl")} />
      <div className="h-11 w-40 self-end rounded-full bg-primary/70" />
    </div>
  );
}

function Chat() {
  return (
    <div className={cn(PANEL, "flex h-[calc(100dvh-180px)] min-h-[24rem] flex-col overflow-hidden")}>
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <div className={cn(B, "size-10 rounded-xl")} />
        <div className="flex flex-col gap-2">
          <Line className="w-32" />
          <Line className="h-3 w-48" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        <div className={cn(B, "h-12 w-2/5 self-end rounded-2xl")} />
        <div className={cn(B, "h-16 w-1/2 rounded-2xl")} />
        <div className={cn(B, "h-12 w-1/3 self-end rounded-2xl")} />
      </div>
      <div className="border-t border-line p-3">
        <div className={cn(B, "h-12 rounded-3xl")} />
      </div>
    </div>
  );
}

/**
 * The staff and owner dashboards' loading screens: grey shapes laid out like the page that is opening (tiles, list,
 * cards, detail panels, form or conversation). Shown only the first time a page opens; pages already opened come
 * back at once from memory.
 */
export function DashSkeleton({ shape }: { shape: DashShape }) {
  const body = (() => {
    switch (shape) {
      case "overview":
        return (
          <>
            <div className="flex flex-col gap-2">
              <Line className="h-6 w-56" />
              <Line className="h-3 w-72" />
            </div>
            <Tiles />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className={cn(PANEL, "flex h-72 items-end gap-2 p-5")}>
                {[30, 55, 20, 70, 45, 90, 35, 60, 25, 80].map((h, i) => (
                  <div key={i} className={cn(B, "flex-1 rounded-t-md")} style={{ height: `${h}%` }} />
                ))}
              </div>
              <Panel lines={4} />
            </div>
          </>
        );
      case "list":
        return (
          <>
            <Toolbar />
            <Rows />
          </>
        );
      case "cards":
        return (
          <>
            <Tiles count={3} />
            <Cards />
          </>
        );
      case "detail":
        return (
          <>
            <div className={cn(PANEL, "flex items-center gap-4 p-5")}>
              <div className={cn(B, "size-14 rounded-2xl")} />
              <div className="flex flex-1 flex-col gap-2">
                <Line className="h-5 w-64" />
                <Line className="h-3 w-40" />
              </div>
              <div className="h-9 w-28 rounded-full bg-primary/70" />
            </div>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="flex flex-col gap-5">
                <Panel lines={5} />
                <Panel lines={3} />
              </div>
              <Panel lines={4} className="self-start" />
            </div>
          </>
        );
      case "form":
        return (
          <>
            <Line className="h-3 w-80" />
            <Form />
          </>
        );
      case "chat":
        return <Chat />;
      case "tabsList":
        return (
          <>
            <Tabs />
            <Toolbar />
            <Rows count={6} />
          </>
        );
      case "tabsCards":
        return (
          <>
            <Tabs />
            <Tiles count={3} />
            <Cards count={4} />
          </>
        );
      case "tabsPanels":
        return (
          <>
            <Tabs />
            <Tiles />
            <div className="grid gap-5 lg:grid-cols-2">
              <Panel lines={4} />
              <Panel lines={4} />
            </div>
          </>
        );
      case "split":
        return (
          <>
            <Tabs />
            <div className="grid gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
              <Form />
              <Cards count={3} />
            </div>
          </>
        );
    }
  })();
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-hidden="true">
      {body}
    </div>
  );
}
