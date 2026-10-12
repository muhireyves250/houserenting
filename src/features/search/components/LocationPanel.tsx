"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { cn } from "@/lib/cn";

export type Suggestion = { city: string; count: number };

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
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-ink">{t("suggested")}</p>
      {empty && <p className="py-4 text-sm text-muted">{t("noMatches", { text: text.trim() })}</p>}
      {/* Always rendered so the combobox's aria-controls resolves even when there are no matches. */}
      <ul id={id} role="listbox" aria-label={t("suggested")} className="flex flex-col gap-1">
        {suggestions?.map((s, index) => (
          <li
            key={s.city}
            id={optionId(id, index)}
            role="option"
            aria-selected={index === activeIndex}
            tabIndex={-1}
            // Keep focus in the input when choosing with the mouse.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(s.city)}
            className={cn(
              "flex cursor-pointer items-center gap-4 rounded-2xl p-2 hover:bg-canvas",
              index === activeIndex && "bg-canvas",
            )}
          >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden="true">
              <MapPin className="size-6" />
            </span>
            <span className="flex flex-col">
              <span className="text-base text-ink">
                {s.city}, {t("country")}
              </span>
              <span className="text-sm text-muted">{t("places", { count: s.count })}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
