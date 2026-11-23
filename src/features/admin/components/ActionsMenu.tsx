"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** One thing that can be done with a row: open a page, or run an action (asking first, with a reason when needed). */
export type RowAction =
  | { kind: "link"; label: string; href: string }
  | {
      kind: "run";
      label: string;
      /** A server action bound to the row (it gets the reason, when one is asked for). */
      action: (reason: string) => Promise<{ ok: boolean; error?: string }>;
      /** Ask "are you sure?" first (this text), and/or ask for a reason the person concerned will read. */
      confirm?: string;
      reason?: boolean;
      danger?: boolean;
      /** Wording for errors the action may return. */
      errors?: Record<string, string>;
    };

/**
 * Every row's one "Actions" button: everything that can be done with it in a small list. Actions that change
 * something ask first (and for a reason where the owner or guest must be told why); the result shows in place.
 */
export function ActionsMenu({ items, align = "right" }: { items: RowAction[]; align?: "left" | "right" }) {
  const t = useTranslations("Admin.actionsMenu");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<Extract<RowAction, { kind: "run" }> | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  // The list floats above the page (so a scrolling list can't cut it off), opening upwards near the bottom.
  const [at, setAt] = useState<{ top?: number; bottom?: number; left?: number; right?: number }>({});

  useEffect(() => {
    if (!open && !asking) return;
    const away = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && (setOpen(false), setAsking(null));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (setOpen(false), setAsking(null));
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, asking]);

  if (items.length === 0) return null;

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const below = window.innerHeight - r.bottom > 280;
    const side = align === "right" ? { right: Math.max(8, window.innerWidth - r.right) } : { left: Math.max(8, r.left) };
    setAt(below ? { top: r.bottom + 6, ...side } : { bottom: window.innerHeight - r.top + 6, ...side });
    setAsking(null);
    setError(null);
    setOpen(!open);
  };

  const run = (item: Extract<RowAction, { kind: "run" }>, why: string) =>
    start(async () => {
      setError(null);
      const r = await item.action(why);
      if (r.ok) {
        setAsking(null);
        setOpen(false);
        setReason("");
        router.refresh();
      } else setError((r.error && item.errors?.[r.error]) || t("failed"));
    });

  const choose = (item: Extract<RowAction, { kind: "run" }>) => {
    setOpen(false);
    setReason("");
    setError(null);
    if (item.confirm || item.reason) setAsking(item);
    else run(item, "");
  };

  const row = "flex w-full items-center rounded-lg px-3 py-2 text-left text-[14px] hover:bg-primary/[0.06]";

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn("inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors", open ? "border-primary text-primary" : "border-line text-ink hover:border-primary")}
      >
        {t("label")}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul role="menu" style={at} data-lenis-prevent className="fixed z-50 max-h-80 w-60 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-[0_18px_40px_-16px_rgba(16,24,40,0.45)]">
          {items.map((item, i) => (
            <li key={i} role="none">
              {item.kind === "link" ? (
                <Link href={item.href} role="menuitem" className={cn(row, "text-ink")} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              ) : (
                <button type="button" role="menuitem" disabled={pending} onClick={() => choose(item)} className={cn(row, item.danger ? "text-danger" : "text-ink")}>
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {asking && (
        // Asks first (and for a reason where needed), right under the button.
        <div style={at} className="fixed z-50 flex w-72 flex-col gap-2 rounded-xl border border-line bg-surface p-3 shadow-[0_18px_40px_-16px_rgba(16,24,40,0.45)]">
          <p className="text-[14px] font-semibold text-ink">{asking.confirm ?? asking.label}</p>
          {asking.reason && <textarea autoFocus rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reason")} className="rounded-lg border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-primary" />}
          {error && <p className="text-[12px] font-medium text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAsking(null)} className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-canvas">
              {t("cancel")}
            </button>
            <button
              type="button"
              disabled={pending || (asking.reason && !reason.trim())}
              onClick={() => run(asking, reason)}
              className={cn("rounded-full px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50", asking.danger ? "bg-danger" : "bg-primary")}
            >
              {asking.label}
            </button>
          </div>
        </div>
      )}
      {!asking && error && <p className="absolute right-0 mt-1 w-56 text-right text-[12px] font-medium text-danger">{error}</p>}
    </div>
  );
}
