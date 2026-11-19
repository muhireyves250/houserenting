import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** An admin card: white, rounded, a hairline ring. */
export const adminCard = "flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line";

/** Small coloured label (status, kind, count). */
export function Chip({ tone = "bg-canvas text-ink", children }: { tone?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold whitespace-nowrap", tone)}>{children}</span>;
}

export type Tile = { label: string; count: number; href?: string | { pathname: string; query?: Record<string, string> }; tone?: string; on?: boolean };

/** Big numbers across the top of a page: what waits, at a glance. Each can filter or jump to its part. */
export function StatTiles({ items }: { items: Tile[] }) {
  return (
    <div className={cn("grid gap-3", items.length >= 4 ? "grid-cols-2 md:grid-cols-4" : items.length === 2 ? "grid-cols-2 md:max-w-xl" : "grid-cols-3")}>
      {items.map((item) => {
        const body = (
          <>
            <span className={cn("block text-[26px] leading-8 font-bold tabular-nums", item.count > 0 ? (item.tone ?? "text-ink") : "text-muted")}>{item.count}</span>
            <span className="text-[13px] font-semibold text-ink">{item.label}</span>
          </>
        );
        const cls = cn("rounded-2xl bg-surface px-4 py-3 ring-1 transition-colors", item.on ? "ring-2 ring-primary" : "ring-line hover:ring-primary/60");
        return item.href ? (
          typeof item.href === "string" && item.href.startsWith("#") ? (
            <a key={item.label} href={item.href} className={cls}>
              {body}
            </a>
          ) : (
            <Link key={item.label} href={item.href} className={cls}>
              {body}
            </Link>
          )
        ) : (
          <div key={item.label} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/** A group on a page: title with its count, then its items (or "nothing"). */
export function Group({ id, title, count, children, empty }: { id?: string; title: string; count: number; children: ReactNode; empty: string }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-3 flex items-center gap-2 text-[17px] font-bold text-ink">
        {title}
        <Chip tone={count > 0 ? "bg-primary text-white" : "bg-canvas text-muted"}>{count}</Chip>
      </h2>
      {count === 0 ? <p className="rounded-2xl bg-surface py-6 text-center text-[14px] text-muted ring-1 ring-line">{empty}</p> : children}
    </section>
  );
}

/** A staff list page that fills the screen: its top row stays put and its list scrolls (see ScrollArea). */
export function FillScreen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("admin-fill flex flex-col gap-4", className)}>{children}</div>;
}

/** The top row of a list page: filters or counters on the left, the page's button on the right, same top line. */
export function Toolbar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    // Phones: the button on its own line on top, the filters/counters full width below.
    <div className="flex shrink-0 items-start justify-between gap-3 max-sm:flex-col-reverse max-sm:items-stretch">
      <div className="min-w-0 flex-1">{children}</div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:justify-end">{actions}</div>}
    </div>
  );
}

/** The scrolling part of a list page (a little inner padding so card shadows aren't cut off). */
export function ScrollArea({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("no-scrollbar -mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pt-1 pb-3", className)}>{children}</div>;
}
