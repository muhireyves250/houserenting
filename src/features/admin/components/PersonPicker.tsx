"use client";

import { Check, ChevronDown, Search, ShieldCheck, UserPlus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { createAccountAction, findPeopleAction } from "../actions";

export type Person = { id: string; name: string; email: string; phone: string | null };

/**
 * Pick a person who has an account: type a name, email or phone number and choose from the suggestions (only active
 * accounts). The chosen account is shown, marked as active, before going on. Nobody found: open their account here
 * (they get an email to set their password). Gives back the chosen person.
 */
export function PersonPicker({
  label,
  onChange,
  onPick,
  canCreate = true,
  only,
}: {
  label: string;
  /** The chosen person's email ("" when cleared). */
  onChange?: (email: string) => void;
  /** The chosen person (null when cleared). */
  onPick?: (person: Person | null) => void;
  /** Offer to open an account when nobody is found. */
  canCreate?: boolean;
  /** Only people with this role (restaurant owners and managers). */
  only?: "restaurant";
}) {
  const t = useTranslations("Admin.picker");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState<Person | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", email: "", phone: "" });
  const [createError, setCreateError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Search as you type (a short pause first), while the list is open.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      setPeople(await findPeopleAction(q, only));
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [q, open, only]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const choose = (p: Person | null) => {
    setChosen(p);
    onChange?.(p?.email ?? "");
    onPick?.(p);
    setOpen(false);
    setCreating(false);
    setQ("");
  };

  const startCreating = () => {
    const looksLikeEmail = q.includes("@");
    const looksLikePhone = /^[+\d\s-]{6,}$/.test(q);
    setDraft({ name: looksLikeEmail || looksLikePhone ? "" : q, email: looksLikeEmail ? q : "", phone: looksLikePhone ? q : "" });
    setCreateError(null);
    setCreating(true);
    setOpen(false);
  };

  const create = () =>
    start(async () => {
      const r = await createAccountAction(draft);
      if (r.ok) choose(r.person);
      else setCreateError(t(`createError.${r.error}`));
    });

  const input = "min-w-0 rounded-xl border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-primary";

  return (
    <div ref={box} className="relative">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {chosen && !open ? (
        <div className="flex items-center gap-3 rounded-2xl border border-line-strong bg-surface px-3 py-2.5">
          <Avatar name={chosen.name} className="size-9 text-xs" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-ink">{chosen.name}</span>
            <span className="block truncate text-[12px] text-muted">{[chosen.email, chosen.phone].filter(Boolean).join(" · ")}</span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {t("activeAccount")}
            </span>
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
        <ul id={listId} role="listbox" data-lenis-prevent className="no-scrollbar absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[0_18px_40px_-16px_rgba(16,24,40,0.45)]">
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
                  <span className="block truncate text-[12px] text-muted">{[p.email, p.phone].filter(Boolean).join(" · ")}</span>
                </span>
                {chosen?.id === p.id && <Check className="size-4 text-primary" aria-hidden="true" />}
              </button>
            </li>
          ))}
          {canCreate && (
            <li className="mt-1 border-t border-line pt-1">
              <button type="button" onClick={startCreating} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-[13px] font-semibold text-primary hover:bg-primary/[0.06]">
                <UserPlus className="size-4" aria-hidden="true" />
                {t("createNew")}
              </button>
            </li>
          )}
        </ul>
      )}
      {/* No account yet: open one here; the person sets their own password from the email. */}
      {creating && !chosen && (
        <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-line bg-canvas p-3">
          <p className="text-[13px] font-semibold text-ink">{t("createTitle")}</p>
          <input className={input} placeholder={t("createName")} aria-label={t("createName")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={input} type="email" placeholder={t("createEmail")} aria-label={t("createEmail")} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            <input className={input} type="tel" placeholder={t("createPhone")} aria-label={t("createPhone")} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </div>
          <p className="text-[12px] text-muted">{t("createHint")}</p>
          {createError && <p className="text-[12px] font-medium text-danger">{createError}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreating(false)} className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink hover:bg-surface">
              {t("createCancel")}
            </button>
            <button type="button" disabled={pending} onClick={create} className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50">
              {t("createSubmit")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
