import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** Short description of the page and its main actions, under the top bar's title. */
export function PageIntro({ description, actions, back }: { description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-primary">
            <ChevronLeft className="size-4" aria-hidden="true" />
            {back.label}
          </Link>
        )}
        {description && <div className="text-[14px] text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className, flush = false }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

/** Data table: sticky header, hairline rows, horizontal scroll on narrow screens. */
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-line bg-canvas/60">
            {head.map((cell, i) => (
              <th key={i} scope="col" className="px-4 py-2.5 text-[12px] font-semibold tracking-wide whitespace-nowrap text-muted uppercase">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export const td = "px-4 py-3 align-middle";

/** Filter chips that are links (shareable URLs, work without JavaScript). */
export function FilterTabs({ items }: { items: { label: string; href: string | { pathname: string; query: Record<string, string> }; on: boolean; count?: number }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
            item.on ? "border-primary bg-primary font-semibold text-white" : "border-line bg-surface text-ink hover:border-primary/60",
          )}
        >
          {item.label}
          {item.count !== undefined && <span className={cn("text-xs tabular-nums", item.on ? "text-white/80" : "text-muted")}>{item.count}</span>}
        </Link>
      ))}
    </div>
  );
}

/** Search box that submits as a GET (keeps the other filters as hidden fields). */
export function SearchBox({ name = "q", value, placeholder, keep = {} }: { name?: string; value: string; placeholder: string; keep?: Record<string, string | undefined> }) {
  return (
    <form className="flex w-full max-w-sm items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 focus-within:border-primary">
      <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <input name={name} defaultValue={value} placeholder={placeholder} aria-label={placeholder} className="w-full bg-transparent text-[14px] outline-none" />
    </form>
  );
}

export function Pagination({ page, pages, hrefFor, label }: { page: number; pages: number; hrefFor: (page: number) => string; label: (page: number, pages: number) => string }) {
  if (pages <= 1) return null;
  const arrow = "flex size-9 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-primary";
  return (
    <nav aria-label={label(page, pages)} className="flex items-center justify-end gap-3 border-t border-line px-4 py-3 text-[13px] text-muted">
      <span>{label(page, pages)}</span>
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={arrow} aria-label="‹">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(arrow, "opacity-30")} aria-hidden="true">
          <ChevronLeft className="size-4" />
        </span>
      )}
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={arrow} aria-label="›">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(arrow, "opacity-30")} aria-hidden="true">
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}

/** Download link for a CSV export (a plain link: the browser saves the file). */
export function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
    >
      <Download className="size-4" aria-hidden="true" />
      {label}
    </a>
  );
}

/** Label / value rows for detail pages. */
export function Facts({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map((r) => (
        <div key={r.label} className="flex items-start justify-between gap-4 py-2.5">
          <dt className="text-[13px] text-muted">{r.label}</dt>
          <dd className="text-right text-[14px] font-medium text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
