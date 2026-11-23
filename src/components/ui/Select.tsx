"use client";

import { Check, ChevronDown } from "lucide-react";
import { Children, isValidElement, useEffect, useId, useRef, useState, type ChangeEvent, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

type Option = { value: string; label: ReactNode; disabled: boolean };

/** Reads <option> children (as a native select takes them) into a list. */
function optionsOf(children: ReactNode): Option[] {
  const out: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
    if (el.type === "option") out.push({ value: String(el.props.value ?? ""), label: el.props.children, disabled: Boolean(el.props.disabled) });
    else if (el.props.children) out.push(...optionsOf(el.props.children));
  });
  return out;
}

type Props = {
  value?: string | number;
  defaultValue?: string | number;
  /** Same shape as a native select's change event (e.target.value), so it drops in where a <select> was. */
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  "aria-label"?: string;
  required?: boolean;
  /** Submit the surrounding form when a choice is made (for filter forms). */
  submitOnChange?: boolean;
};

/**
 * VIIPA's own dropdown, used instead of the browser's: a styled list under the field on computers, and a sheet from
 * the bottom on phones (big rows, easy to tap, the current choice ticked). Keyboard: arrows, Enter, Escape.
 * Takes <option> children and gives back e.target.value, like a <select>; with `name` it sends its value in forms.
 */
export function Select({ value, defaultValue, onChange, children, className, disabled, name, id, required, submitOnChange, "aria-label": ariaLabel }: Props) {
  const options = optionsOf(children);
  const [own, setOwn] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const current = value !== undefined ? String(value) : own;
  const selected = options.find((o) => o.value === current) ?? options[0];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [phone, setPhone] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number; width: number; up: boolean }>({ top: 0, left: 0, width: 0, up: false });
  const button = useRef<HTMLButtonElement>(null);
  const hidden = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !button.current?.contains(e.target as Node) && !list.current?.contains(e.target as Node) && setOpen(false);
    const close = () => !phone && setOpen(false);
    // The page scrolling moves the field away, so the list closes; scrolling inside the list itself (a long list, or
    // it scrolling to the current choice as it opens) must not, or the list shuts before anything can be picked.
    const onScroll = (e: Event) => {
      if (list.current && e.target instanceof Node && list.current.contains(e.target)) return;
      close();
    };
    document.addEventListener("pointerdown", away);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", away);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, phone]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    if (disabled || !button.current) return;
    const r = button.current.getBoundingClientRect();
    const small = window.matchMedia?.("(max-width: 640px)").matches ?? false;
    setPhone(small);
    const up = window.innerHeight - r.bottom < 260 && r.top > 260;
    setAt({ top: up ? r.top : r.bottom, left: r.left, width: r.width, up });
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  };

  const choose = (o: Option) => {
    if (o.disabled) return;
    setOpen(false);
    if (value === undefined) setOwn(o.value);
    if (hidden.current) hidden.current.value = o.value;
    onChange?.({ target: { value: o.value, name: name ?? "" }, currentTarget: { value: o.value, name: name ?? "" } } as unknown as ChangeEvent<HTMLSelectElement>);
    button.current?.focus();
    if (submitOnChange) setTimeout(() => hidden.current?.form?.requestSubmit(), 0);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      return show();
    }
    if (!open) return;
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    }
    if (e.key === "Enter" && options[active]) {
      e.preventDefault();
      choose(options[active]);
    }
  };

  const items = options.map((o, i) => {
    const on = o.value === current;
    return (
      <li
        key={`${o.value}-${i}`}
        role="option"
        data-i={i}
        aria-selected={on}
        aria-disabled={o.disabled}
        onPointerEnter={() => setActive(i)}
        onClick={() => choose(o)}
        className={cn(
          "flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3",
          phone ? "py-3.5 text-[16px]" : "py-2 text-[14px]",
          o.disabled ? "cursor-default text-muted opacity-50" : i === active ? "bg-primary/[0.08] text-ink" : "text-ink",
          on && "font-semibold text-primary",
        )}
      >
        <span className="min-w-0 truncate">{o.label}</span>
        {on && <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />}
      </li>
    );
  });

  return (
    <>
      <button
        ref={button}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-required={required}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        className={cn("inline-flex min-w-0 items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60", className)}
      >
        <span className="min-w-0 truncate">{selected?.label ?? ""}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {name && <input ref={hidden} type="hidden" name={name} value={current} readOnly />}
      {open &&
        createPortal(
          phone ? (
            // Phones: a sheet from the bottom.
            <div className="fixed inset-0 z-[80]" onKeyDown={onKey}>
              <div className="absolute inset-0 bg-[#00142e]/40 motion-safe:animate-[fade-in_200ms_ease-out]" onClick={() => setOpen(false)} />
              <div className="absolute inset-x-0 bottom-0 max-h-[70dvh] rounded-t-3xl bg-surface px-3 pt-2 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-2xl motion-safe:animate-[sheet-up_220ms_ease-out]">
                <span aria-hidden="true" className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-line-strong" />
                {ariaLabel && <p className="px-3 pb-2 text-[13px] font-semibold text-muted">{ariaLabel}</p>}
                <ul ref={list} id={listId} role="listbox" data-lenis-prevent className="no-scrollbar max-h-[60dvh] overflow-y-auto overscroll-contain">
                  {items}
                </ul>
              </div>
            </div>
          ) : (
            <ul
              ref={list}
              id={listId}
              role="listbox"
              data-lenis-prevent
              style={{ left: at.left, width: Math.max(at.width, 180), ...(at.up ? { bottom: window.innerHeight - at.top + 6 } : { top: at.top + 6 }) }}
              className="fixed z-[80] max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[0_18px_40px_-16px_rgba(16,24,40,0.45)]"
            >
              {items}
            </ul>
          ),
          document.body,
        )}
    </>
  );
}
