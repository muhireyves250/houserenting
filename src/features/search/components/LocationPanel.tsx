"use client";

import { ChevronRight, MapPin } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export type Suggestion = { city: string; count: number; photo?: string | null };

export const optionId = (listboxId: string, index: number) => `${listboxId}-option-${index}`;

/**
 * Listbox for the Where combobox. The input keeps focus (ARIA 1.2 combobox pattern): the parent owns
 * `activeIndex` and moves it with the arrow keys; options are not tab stops.
 */
export function LocationPanel({
  id,
  text,
  suggestions,
  activeIndex,
  onSuggestions,
  onPick,
}: {
  id: string;
  text: string;
  suggestions: Suggestion[] | null;
  activeIndex: number;
  onSuggestions: (suggestions: Suggestion[]) => void;
  onPick: (city: string) => void;
}) {
  const t = useTranslations("Home");

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/locations?q=${encodeURIComponent(text.trim())}`, { signal: controller.signal });
        if (res.ok) onSuggestions(((await res.json()) as { locations: Suggestion[] }).locations);
      } catch {
        // Aborted or offline: keep the previous list.
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // onSuggestions is a stable setter from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const empty = suggestions !== null && suggestions.length === 0 && text.trim() !== "";

  return (
    <div className="flex flex-col gap-2">
      <p className="px-2 text-[11px] font-bold tracking-[0.14em] text-muted uppercase">{t("suggested")}</p>
      {empty && <p className="px-2 py-4 text-sm text-muted">{t("noMatches", { text: text.trim() })}</p>}
      {/* Always rendered so the combobox's aria-controls resolves even when there are no matches. */}
      <ul id={id} role="listbox" aria-label={t("suggested")} className="flex flex-col gap-0.5">
        {suggestions?.map((s, index) => {
          const active = index === activeIndex;
          return (
            <li
              key={s.city}
              id={optionId(id, index)}
              role="option"
              aria-selected={active}
              tabIndex={-1}
              // Keep focus in the input when choosing with the mouse.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(s.city)}
              className={cn(
                "group/option flex cursor-pointer items-center gap-4 rounded-2xl p-2.5 transition-colors duration-200",
                "hover:bg-canvas",
                active && "bg-primary/[0.06]",
              )}
            >
              <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary shadow-sm">
                <CityThumb photo={s.photo} />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-[15px] font-semibold text-ink">
                  {s.city}, {t("country")}
                </span>
                <span className="text-sm text-muted">{t("places", { count: s.count })}</span>
              </span>
              <ChevronRight
                className={cn(
                  "size-4 -translate-x-1 text-primary opacity-0 transition-[opacity,transform] duration-200",
                  "group-hover/option:translate-x-0 group-hover/option:opacity-100",
                  active && "translate-x-0 opacity-100",
                )}
                aria-hidden="true"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** City photo, falling back to a map pin when there is none or it fails to load. */
function CityThumb({ photo }: { photo?: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!photo || failed) return <MapPin className="size-6" aria-hidden="true" />;
  return <Image src={photo} alt="" fill sizes="56px" className="object-cover" onError={() => setFailed(true)} />;
}
