"use client";

import { Check, ChevronDown, Globe } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

/** Each language in its own name, so people recognise theirs whatever the current UI language. */
const NATIVE_NAMES: Record<AppLocale, string> = { en: "English", rw: "Ikinyarwanda", fr: "Français" };

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("Locale");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  // Focus the current language when the menu opens; close on outside click.
  useEffect(() => {
    if (!open) return;
    itemRefs.current[routing.locales.indexOf(locale)]?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, locale]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function choose(next: AppLocale) {
    setOpen(false);
    if (next === locale) return;
    startTransition(() => {
      router.replace({ pathname, query: Object.fromEntries(searchParams) }, { locale: next });
    });
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = itemRefs.current;
    const index = items.findIndex((el) => el === document.activeElement);
    const count = routing.locales.length;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      items[(index + step + count) % count]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : count - 1]?.focus();
    } else if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      close();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${tNav("language")}: ${NATIVE_NAMES[locale]}`}
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 items-center gap-2 rounded-full border border-primary/60 px-4 text-[15px] font-semibold tracking-[0.01em] text-primary",
          "transition-colors duration-300 hover:border-primary hover:bg-primary/[0.06]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "group-data-[overlay=true]/header:border-[#8cc0ff] group-data-[overlay=true]/header:text-white group-data-[overlay=true]/header:hover:bg-white/10",
          open && "border-primary bg-primary/[0.06]",
          className,
        )}
      >
        <Globe className="size-4" aria-hidden="true" />
        <span>{NATIVE_NAMES[locale]}</span>
        <ChevronDown className={cn("size-4 transition-transform duration-300", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={tNav("chooseLanguage")}
          onKeyDown={onMenuKeyDown}
          className="absolute top-full right-0 z-50 mt-2 w-64 rounded-2xl border border-line/70 bg-surface p-2 shadow-[0_18px_50px_-12px_rgba(0,20,60,0.35)] motion-safe:animate-pop-in"
        >
          <p className="px-3 pt-2 pb-2 text-xs font-bold tracking-[0.12em] text-muted uppercase" aria-hidden="true">
            {tNav("chooseLanguage")}
          </p>
          {routing.locales.map((value, index) => {
            const current = value === locale;
            return (
              <button
                key={value}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={current}
                lang={value}
                tabIndex={current ? 0 : -1}
                onClick={() => choose(value)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200",
                  "hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none",
                  current && "bg-primary/[0.06]",
                )}
              >
                <span className="flex flex-1 flex-col">
                  <span className={cn("text-[15px] font-semibold", current ? "text-primary" : "text-ink")}>{NATIVE_NAMES[value]}</span>
                  <span className="text-xs text-muted">{t(value)}</span>
                </span>
                {current && <Check className="size-4 text-primary" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
