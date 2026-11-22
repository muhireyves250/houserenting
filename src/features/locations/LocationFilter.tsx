"use client";

import { MapPin, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { locationChildrenAction, locationCodesAction } from "./actions";

const LEVELS = ["province", "district", "sector", "cell", "village"] as const;
type Level = (typeof LEVELS)[number];
type Place = { code: string; name: string };

/** Filter by official location: province down to village, stopping at any level. Keeps the page's other filters. */
export function LocationFilter({ pathname, current, keep }: { pathname: "/admin/listings"; current: string | null; keep: Record<string, string> }) {
  const t = useTranslations("Locations");
  const router = useRouter();
  const [codes, setCodes] = useState<Partial<Record<Level, string>>>({});
  const [options, setOptions] = useState<Partial<Record<Level, Place[]>>>({});

  useEffect(() => {
    if (current) locationCodesAction(current).then((c) => c && setCodes(c));
  }, [current]);

  useEffect(() => {
    let live = true;
    (async () => {
      const next: Partial<Record<Level, Place[]>> = {};
      for (const [i, level] of LEVELS.entries()) {
        const parent = i === 0 ? null : codes[LEVELS[i - 1]!];
        if (i > 0 && !parent) break;
        next[level] = await locationChildrenAction(level, parent ?? null);
      }
      if (live) setOptions(next);
    })();
    return () => {
      live = false;
    };
  }, [codes]);

  const go = (code: string | null) => router.push({ pathname, query: { ...keep, ...(code ? { loc: code } : {}) } });
  const choose = (level: Level, code: string) => {
    const i = LEVELS.indexOf(level);
    const next: Partial<Record<Level, string>> = {};
    for (const l of LEVELS.slice(0, i)) next[l] = codes[l];
    if (code) next[level] = code;
    setCodes(next);
    // The deepest level chosen is the filter.
    go(code || (i > 0 ? (codes[LEVELS[i - 1]!] ?? null) : null));
  };

  return (
    <div data-lenis-prevent className="filter-row mt-2 flex flex-wrap items-center gap-2">
      <MapPin className="size-4 shrink-0 text-muted" aria-hidden="true" />
      {LEVELS.map((level, i) =>
        i === 0 || codes[LEVELS[i - 1]!] ? (
          <select
            key={level}
            aria-label={t(`level.${level}`)}
            value={codes[level] ?? ""}
            onChange={(e) => choose(level, e.target.value)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink"
          >
            <option value="">{t(`level.${level}`)}</option>
            {(options[level] ?? []).map((o) => (
              <option key={o.code} value={o.code}>
                {o.name}
              </option>
            ))}
          </select>
        ) : null,
      )}
      {current && (
        <button type="button" onClick={() => go(null)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-primary/[0.06]">
          <X className="size-3.5" aria-hidden="true" />
          {t("clear")}
        </button>
      )}
    </div>
  );
}
