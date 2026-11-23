"use client";

import { Select } from "@/components/ui/Select";

import { MapPin, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { locationChildrenAction, locationCodesAction, searchLocationsAction } from "./actions";

const LEVELS = ["province", "district", "sector", "cell", "village"] as const;
type Level = (typeof LEVELS)[number];
type Place = { code: string; name: string };

/** What the picker gives back: the official names at each level and the village's code. */
export type LocationValue = { province: string; district: string; sector: string; cell: string; village: string; villageCode: string };
export const EMPTY_LOCATION: LocationValue = { province: "", district: "", sector: "", cell: "", village: "", villageCode: "" };

/**
 * Rwanda's official locations, province down to village. Each choice loads only the real places under it (Northern
 * Province shows its five districts); or search a sector, cell or village by name and pick it. Nothing is typed by hand.
 */
export function LocationPicker({ value, onChange, error, startCodes }: { value: LocationValue; onChange: (v: LocationValue) => void; error?: string; startCodes?: Partial<Record<Level, string>> | null }) {
  const t = useTranslations("Locations");
  const [codes, setCodes] = useState<Partial<Record<Level, string>>>(startCodes ?? {});
  const [options, setOptions] = useState<Partial<Record<Level, Place[]>>>({});
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ code: string; level: Level; label: string; path: string }[]>([]);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Load the options of every level whose parent is chosen.
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

  // Search as you type (a short pause first).
  useEffect(() => {
    if (q.trim().length < 2) return;
    const timer = setTimeout(async () => setResults(await searchLocationsAction(q)), 200);
    return () => clearTimeout(timer);
  }, [q]);

  // Tell the form the chosen names; the village code only once a village is chosen.
  useEffect(() => {
    const name = (level: Level) => options[level]?.find((o) => o.code === codes[level])?.name ?? "";
    const next: LocationValue = { province: name("province"), district: name("district"), sector: name("sector"), cell: name("cell"), village: name("village"), villageCode: codes.village && name("village") ? codes.village : "" };
    if (LEVELS.some((l) => codes[l] && !options[l])) return; // still loading
    onChangeRef.current(next);
  }, [codes, options]);

  const choose = (level: Level, code: string) => {
    const i = LEVELS.indexOf(level);
    const next: Partial<Record<Level, string>> = {};
    for (const l of LEVELS.slice(0, i)) next[l] = codes[l];
    if (code) next[level] = code;
    setCodes(next);
  };

  const pick = async (code: string) => {
    const found = await locationCodesAction(code);
    if (found) setCodes(found);
    setQ("");
    setResults([]);
  };

  const select = "w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-ink disabled:bg-canvas disabled:text-muted";

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <label className="flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2.5 focus-within:border-primary">
          <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none" />
        </label>
        {q.trim().length >= 2 && results.length > 0 && (
          <ul role="listbox" data-lenis-prevent className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
            {results.map((r) => (
              <li key={r.code}>
                <button type="button" onClick={() => pick(r.code)} className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-primary/[0.06]">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-ink">
                      {r.label} <span className="text-[12px] font-normal text-muted">· {t(`level.${r.level}`)}</span>
                    </span>
                    <span className="block truncate text-[12px] text-muted">{r.path}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {LEVELS.map((level, i) => {
          const parentChosen = i === 0 || Boolean(codes[LEVELS[i - 1]!]);
          return (
            <label key={level} className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted">{t(`level.${level}`)}</span>
              <Select value={codes[level] ?? ""} disabled={!parentChosen || !options[level]} onChange={(e) => choose(level, e.target.value)} className={select}>
                <option value="">{parentChosen ? t("choose") : t("chooseAbove")}</option>
                {(options[level] ?? []).map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </label>
          );
        })}
      </div>
      {value.villageCode ? (
        <p className="text-[12px] text-muted">{[value.village, value.cell, value.sector, value.district, value.province].join(", ")}</p>
      ) : (
        error && <p className="text-[13px] font-medium text-danger">{error}</p>
      )}
    </div>
  );
}
