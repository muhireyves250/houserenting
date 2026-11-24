"use client";

import { ArrowDown, ArrowUp, Flame, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { deleteSectionAction, moveSectionAction, pickHousesAction, saveSectionAction } from "../actions";

type House = { id: string; title: string; city: string };
type Section = { id: string; kind: "CUSTOM" | "HOT_DEALS"; title: string; subtitle: string; places: string[]; types: string[]; mode: string; houseIds: string[]; active: boolean; houses: House[] };
const TYPES = ["APARTMENT", "PRIVATE_HOUSE", "GUEST_HOUSE"] as const;
const NEW: Section = { id: "", kind: "CUSTOM", title: "", subtitle: "", places: [], types: [], mode: "short", houseIds: [], active: true, houses: [] };

/** Staff: the guest home page's rows, in order: turn on/off, move, edit (title, towns, kinds, houses first), add, remove. */
export function HomeSectionsEditor({ sections }: { sections: Section[] }) {
  const t = useTranslations("Admin.homePage");
  const tType = useTranslations("ListingType");
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">{t("intro")}</p>
      <ol className="flex flex-col gap-3">
        {sections.map((s, i) => (
          <li key={s.id} className={cn("rounded-2xl bg-surface p-4 ring-1", s.active ? "ring-line" : "opacity-70 ring-line")}>
            {editing === s.id ? (
              <SectionForm initial={s} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-canvas text-[14px] font-bold text-ink">{s.kind === "HOT_DEALS" ? <Flame className="size-5 text-orange-500" aria-hidden="true" /> : i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold text-ink">{s.title}</span>
                    {s.subtitle && <span className="block text-[13px] text-muted">{s.subtitle}</span>}
                    <span className="mt-1 block text-[12px] text-muted">
                      {s.kind === "HOT_DEALS"
                        ? t("hotRule")
                        : [s.places.length ? s.places.join(", ") : t("anywhere"), s.types.length ? s.types.map((x) => tType(x as "APARTMENT")).join(", ") : t("allKinds"), s.mode === "long" ? t("long") : t("short")].join(" · ")}
                    </span>
                    {s.houses.length > 0 && (
                      <span className="mt-1 block text-[12px] text-ink">
                        <b className="font-semibold">{t("first")}</b> {s.houses.map((h) => h.title).join(", ")}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={s.active}
                    aria-label={t("shown")}
                    disabled={pending}
                    onClick={() => run(() => saveSectionAction(s.id, { ...s, mode: s.mode === "long" ? "long" : "short", active: !s.active }))}
                    className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", s.active ? "bg-emerald-600" : "bg-line-strong")}
                  >
                    <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", s.active ? "left-[18px]" : "left-0.5")} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditing(s.id)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[13px] font-semibold text-white">
                    <Pencil className="size-3.5" aria-hidden="true" />
                    {t("edit")}
                  </button>
                  <button type="button" aria-label={t("up")} disabled={pending || i === 0} onClick={() => run(() => moveSectionAction(s.id, "up"))} className="flex size-9 items-center justify-center rounded-xl ring-1 ring-line disabled:opacity-40">
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={t("down")} disabled={pending || i === sections.length - 1} onClick={() => run(() => moveSectionAction(s.id, "down"))} className="flex size-9 items-center justify-center rounded-xl ring-1 ring-line disabled:opacity-40">
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                  {s.kind === "CUSTOM" && (
                    <button type="button" disabled={pending} onClick={() => confirm(t("deleteConfirm", { title: s.title })) && run(() => deleteSectionAction(s.id))} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-danger ring-1 ring-red-200">
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      {t("delete")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      {editing === "new" ? (
        <div className="rounded-2xl bg-surface p-4 ring-2 ring-primary">
          <SectionForm initial={NEW} onDone={() => setEditing(null)} />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 text-[15px] font-semibold text-primary hover:border-primary">
          <Plus className="size-5" aria-hidden="true" />
          {t("add")}
        </button>
      )}
    </div>
  );
}

/** One row's settings: title and subtitle, towns, kinds of place, short or long stays, and the houses shown first. */
function SectionForm({ initial, onDone }: { initial: Section; onDone: () => void }) {
  const t = useTranslations("Admin.homePage");
  const tType = useTranslations("ListingType");
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [placesText, setPlacesText] = useState(initial.places.join(", "));
  const [q, setQ] = useState("");
  const [found, setFound] = useState<House[]>([]);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const hot = s.kind === "HOT_DEALS";

  useEffect(() => {
    const timer = setTimeout(async () => setFound(await pickHousesAction(q)), 200);
    return () => clearTimeout(timer);
  }, [q]);

  const setHouses = (houses: House[]) => setS({ ...s, houses, houseIds: houses.map((h) => h.id) });
  const move = (i: number, d: -1 | 1) => {
    const list = [...s.houses];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    setHouses(list);
  };
  const save = () =>
    start(async () => {
      const places = placesText.split(",").map((p) => p.trim()).filter(Boolean);
      const r = await saveSectionAction(initial.id || null, { title: s.title, subtitle: s.subtitle, places, types: s.types, mode: s.mode === "long" ? "long" : "short", houseIds: s.houseIds, active: s.active });
      setError(!r.ok);
      if (r.ok) {
        onDone();
        router.refresh();
      }
    });
  const field = "h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-[14px] text-ink outline-none focus:border-primary";

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-muted">{t("title")}</span>
        <input className={field} value={s.title} maxLength={80} onChange={(e) => setS({ ...s, title: e.target.value })} placeholder={t("titleHint")} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-muted">{t("subtitle")}</span>
        <input className={field} value={s.subtitle} maxLength={120} onChange={(e) => setS({ ...s, subtitle: e.target.value })} />
      </label>
      {!hot && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted">{t("places")}</span>
            <input className={field} value={placesText} onChange={(e) => setPlacesText(e.target.value)} placeholder={t("placesHint")} />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted">{t("kinds")}</span>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((type) => {
                const on = s.types.includes(type);
                return (
                  <button key={type} type="button" aria-pressed={on} onClick={() => setS({ ...s, types: on ? s.types.filter((x) => x !== type) : [...s.types, type] })} className={cn("h-9 rounded-full px-3.5 text-[13px] font-semibold ring-1", on ? "bg-primary text-white ring-primary" : "bg-surface text-ink ring-line")}>
                    {tType(type)}
                  </button>
                );
              })}
            </div>
            <span className="text-[12px] text-muted">{t("kindsHint")}</span>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1 ring-1 ring-line">
            {(["short", "long"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={s.mode === m} onClick={() => setS({ ...s, mode: m })} className={cn("h-10 rounded-lg text-[13px] font-semibold", s.mode === m ? "bg-primary text-white" : "text-ink")}>
                {t(m)}
              </button>
            ))}
          </div>
        </>
      )}

      {/* The houses shown first in this row, in this order. */}
      <div className="flex flex-col gap-2 rounded-xl bg-canvas p-3">
        <span className="text-xs font-semibold text-muted">{hot ? t("hotFirst") : t("housesFirst")}</span>
        {s.houses.length > 0 && (
          <ol className="flex flex-col gap-1.5">
            {s.houses.map((h, i) => (
              <li key={h.id} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-[13px] ring-1 ring-line">
                <span className="w-5 font-bold text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  <b className="font-semibold text-ink">{h.title}</b> <span className="text-muted">· {h.city}</span>
                </span>
                <button type="button" aria-label={t("up")} onClick={() => move(i, -1)} className="flex size-7 items-center justify-center rounded-md hover:bg-canvas">
                  <ArrowUp className="size-3.5" aria-hidden="true" />
                </button>
                <button type="button" aria-label={t("down")} onClick={() => move(i, 1)} className="flex size-7 items-center justify-center rounded-md hover:bg-canvas">
                  <ArrowDown className="size-3.5" aria-hidden="true" />
                </button>
                <button type="button" aria-label={t("removeHouse", { title: h.title })} onClick={() => setHouses(s.houses.filter((x) => x.id !== h.id))} className="flex size-7 items-center justify-center rounded-md text-danger hover:bg-red-50">
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}
        <label className="flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 focus-within:border-primary">
          <Search className="size-4 text-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchHouse")} aria-label={t("searchHouse")} className="h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
        </label>
        <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto" data-lenis-prevent>
          {found
            .filter((h) => !s.houseIds.includes(h.id))
            .slice(0, 8)
            .map((h) => (
              <li key={h.id}>
                <button type="button" onClick={() => setHouses([...s.houses, h])} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-surface">
                  <Plus className="size-3.5 text-primary" aria-hidden="true" />
                  <b className="font-semibold text-ink">{h.title}</b> <span className="text-muted">· {h.city}</span>
                </button>
              </li>
            ))}
        </ul>
      </div>

      {error && <p className="text-[13px] font-medium text-danger">{t("failed")}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onDone} className="h-11 rounded-xl text-[14px] font-semibold text-ink ring-1 ring-line">
          {t("cancel")}
        </button>
        <button type="button" disabled={pending || s.title.trim().length < 2} onClick={save} className="h-11 rounded-xl bg-primary text-[14px] font-semibold text-white disabled:opacity-50">
          {t("save")}
        </button>
      </div>
    </div>
  );
}
