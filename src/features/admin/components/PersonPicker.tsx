"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { findPeopleAction } from "../actions";

type Person = { id: string; name: string; email: string };

/**
 * Pick a person who has an account: a drop-down of everyone (newest first) that narrows as you type a name or email.
 * Gives back the chosen person's email.
 */
export function PersonPicker({ label, onChange }: { label: string; onChange: (email: string) => void }) {
  const t = useTranslations("Admin.picker");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState<Person | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Search as you type (a short pause first), while the list is open.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      setPeople(await findPeopleAction(q));
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const choose = (p: Person | null) => {
    setChosen(p);
    onChange(p?.email ?? "");
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={box} className="relative">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {chosen && !open ? (
        <div className="flex items-center gap-3 rounded-2xl border border-line-strong bg-surface px-3 py-2.5">
          <Avatar name={chosen.name} className="size-9 text-xs" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-ink">{chosen.name}</span>
            <span className="block truncate text-[12px] text-muted">{chosen.email}</span>
          </span>
          <button type="button" onClick={() => choose(null)} aria-label={t("clear")} className="flex size-8 items-center justify-center rounded-full text-ink/60 hover:bg-canvas">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-2 rounded-2xl border border-line-strong bg-surface px-3 py-3 focus-within:border-primary">
          <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={t("placeholder")}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={label}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none"
          />
          <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
        </label>
      )}
      {open && (
        <ul id={listId} role="listbox" className="no-scrollbar absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[0_18px_40px_-16px_rgba(16,24,40,0.45)]">
          {loading && people.length === 0 && <li className="px-3 py-3 text-[13px] text-muted">{t("loading")}</li>}
          {!loading && people.length === 0 && <li className="px-3 py-3 text-[13px] text-muted">{t("none")}</li>}
          {people.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={chosen?.id === p.id}
                onClick={() => choose(p)}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-primary/[0.06]"
              >
                <Avatar name={p.name} className="size-8 text-[11px]" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{p.name}</span>
                  <span className="block truncate text-[12px] text-muted">{p.email}</span>
                </span>
                {chosen?.id === p.id && <Check className="size-4 text-primary" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
