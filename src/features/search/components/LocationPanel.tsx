"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type Suggestion = { city: string; count: number };

export function LocationPanel({ id, text, onPick }: { id: string; text: string; onPick: (city: string) => void }) {
  const t = useTranslations("Home");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/locations?q=${encodeURIComponent(text.trim())}`, { signal: controller.signal });
        if (res.ok) setSuggestions(((await res.json()) as { locations: Suggestion[] }).locations);
      } catch {
        // Aborted or offline: keep the previous list.
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-ink">{t("suggested")}</p>
      {suggestions && suggestions.length === 0 && text.trim() ? (
        <p className="py-4 text-sm text-muted">{t("noMatches", { text: text.trim() })}</p>
      ) : (
        <ul id={id} role="listbox" aria-label={t("suggested")} className="flex flex-col gap-1">
          {suggestions?.map((s) => (
            <li
              key={s.city}
              role="option"
              aria-selected={false}
              tabIndex={0}
              onClick={() => onPick(s.city)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onPick(s.city);
                }
              }}
              className="flex cursor-pointer items-center gap-4 rounded-2xl p-2 hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none"
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
      )}
    </div>
  );
}
