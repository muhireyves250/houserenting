"use client";

import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type MouseEvent, type ReactNode } from "react";
import { setResultsPending } from "@/features/search/results-pending";
import { createPortal } from "react-dom";
import { useMediaQuery } from "@/lib/use-media-query";
import { AMENITIES, filterParams, PLACE_TYPES, type Amenity, type PlaceType, type SearchFilters, type SearchMode } from "@/features/search/params";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type Panel = "price" | "type" | "more" | null;

const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";
// Same motion as the search bar's hover pill.
const SLIDE = "transition-[transform,width,opacity] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none";

/**
 * Results-page filters (type of place, price). Each panel edits a draft and "Show results" pushes
 * it into the URL, keeping the rest of the search (`base`: mode, location, dates, guests…).
 */
export function FilterBar({ base, mode, filters }: { base: Record<string, string>; mode: SearchMode; filters: SearchFilters }) {
  const t = useTranslations("Search");
  const tType = useTranslations("ListingType");
  const tFacility = useTranslations("Facility");
  const router = useRouter();
  const [open, setOpen] = useState<Panel>(null);
  // Apply in a transition so the results list can show a skeleton until the filtered results arrive.
  const [loading, startLoading] = useTransition();
  useEffect(() => setResultsPending(loading), [loading]);
  const rootRef = useRef<HTMLDivElement>(null);
  // Hover shade (like the search bar): one pill slides to the filter under the mouse; kept in place as it fades out.
  const [shade, setShade] = useState({ left: 0, width: 0, visible: false });
  const hover = (event: MouseEvent<HTMLButtonElement>) => {
    const el = event.currentTarget;
    const root = rootRef.current?.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    setShade({ left: box.left - (root?.left ?? 0), width: box.width, visible: true });
  };

  // Close on outside click or Esc.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element;
      if (!rootRef.current?.contains(target) && !target.closest?.("[data-filter-sheet]")) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function apply(next: SearchFilters) {
    setOpen(null);
    // Results update right here: same page, same scroll position.
    startLoading(() => router.replace({ pathname: "/search", query: { ...base, ...filterParams(next) } }, { scroll: false }));
  }

  const typeCount = filters.types?.length ?? 0;
  const moreCount = (filters.bedrooms ? 1 : 0) + (filters.amenities?.length ?? 0);
  const priceActive = Boolean(filters.minPrice || filters.maxPrice);
  const formatter = new Intl.NumberFormat();
  const priceSummary = priceActive
    ? `${filters.minPrice ? formatter.format(filters.minPrice) : "0"} – ${filters.maxPrice ? formatter.format(filters.maxPrice) : "∞"}`
    : null;

  return (
    <div
      ref={rootRef}
      className="relative flex w-full min-w-0 items-center gap-2 overflow-x-auto max-md:justify-center-safe md:w-auto [scrollbar-width:none] max-md:-mx-4 max-md:px-4 md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden"
      onMouseLeave={() => setShade((current) => ({ ...current, visible: false }))}
    >
      <span
        data-testid="filter-hover"
        data-visible={shade.visible}
        aria-hidden="true"
        style={{ width: `${shade.width}px`, transform: `translateX(${shade.left}px)` }}
        className={cn("pointer-events-none absolute top-0 left-0 h-full rounded-full bg-ink/[0.07]", SLIDE, shade.visible ? "opacity-100" : "opacity-0")}
      />
      <FilterButton
        onHover={hover}
        label={t("price")}
        active={priceActive}
        badge={priceSummary}
        open={open === "price"}
        onToggle={() => setOpen(open === "price" ? null : "price")}
        onClose={() => setOpen(null)}
      >
        <PricePanel
          hint={mode === "long" ? t("priceHintLong") : t("priceHintShort")}
          initial={filters}
          onApply={(range) => apply({ ...filters, ...range })}
        />
      </FilterButton>
      <FilterButton
        onHover={hover}
        label={t("typeOfPlace")}
        active={typeCount > 0}
        badge={typeCount > 0 ? String(typeCount) : null}
        open={open === "type"}
        onToggle={() => setOpen(open === "type" ? null : "type")}
        onClose={() => setOpen(null)}
      >
        <TypePanel labels={(type) => tType(type)} initial={filters.types ?? []} onApply={(types) => apply({ ...filters, types })} />
      </FilterButton>
      <FilterButton
        onHover={hover}
        label={t("moreFilters")}
        active={moreCount > 0}
        badge={moreCount > 0 ? String(moreCount) : null}
        open={open === "more"}
        onToggle={() => setOpen(open === "more" ? null : "more")}
        onClose={() => setOpen(null)}
      >
        <MorePanel
          amenityLabel={(a) => tFacility(a)}
          initial={filters}
          onApply={(more) => apply({ ...filters, ...more })}
        />
      </FilterButton>
      {(typeCount > 0 || priceActive || moreCount > 0) && (
        <button
          type="button"
          onMouseEnter={hover}
          onClick={() => apply({})}
          className="relative shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap text-ink underline underline-offset-4 transition-colors hover:text-primary"
        >
          {t("clearAll")}
        </button>
      )}
    </div>
  );
}

function FilterButton({
  onHover,
  label,
  active,
  badge,
  open,
  onToggle,
  onClose,
  children,
}: {
  onHover: (event: MouseEvent<HTMLButtonElement>) => void;
  onClose: () => void;
  label: string;
  active: boolean;
  badge: string | null;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = useId();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        onMouseEnter={onHover}
        onClick={onToggle}
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap transition-[border-color,background-color,color,box-shadow] duration-300",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          active || open
            ? "border-primary bg-primary/[0.06] text-primary"
            : "border-line text-ink hover:border-primary hover:text-primary active:scale-95",
        )}
      >
        {label}
        {badge && (
          <span aria-hidden="true" className="rounded-full bg-primary px-2 py-0.5 text-xs leading-4 font-bold text-white tabular-nums">
            {badge}
          </span>
        )}
        <ChevronDown className={cn(`size-4 transition-transform duration-300 ${EASE}`, open && "rotate-180")} aria-hidden="true" />
      </button>
      {open &&
        (isDesktop ? (
          <div
            id={panelId}
            role="dialog"
            aria-label={label}
            className="absolute top-[calc(100%+8px)] left-0 z-50 w-[340px] animate-pop-in rounded-2xl border border-line/70 bg-surface p-5 shadow-[0_18px_48px_-12px_rgba(16,24,40,0.3)]"
          >
            {children}
          </div>
        ) : (
          // Phones: a bottom sheet over a dimmed page (portalled: the sticky, blurred filter bar would trap it).
          createPortal(
            <div data-filter-sheet className="fixed inset-0 z-[60] flex items-end md:hidden">
              <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-[#00142e]/40 motion-safe:animate-[fade-in_250ms_ease-out]" />
              <div
                id={panelId}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                className="relative w-full rounded-t-[28px] bg-surface px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-12px_rgba(16,24,40,0.4)] motion-safe:animate-sheet-up"
              >
                <span className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-line-strong" aria-hidden="true" />
                <h2 className="mb-4 text-center text-lg font-bold text-ink">{label}</h2>
                {children}
              </div>
            </div>,
            document.body,
          )
        ))}
    </div>
  );
}

const APPLY =
  "rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_14px_-6px_rgba(0,87,184,0.85)] transition-colors hover:bg-primary-hover";
const CLEAR = "text-sm font-semibold text-ink underline underline-offset-4 transition-colors hover:text-primary disabled:opacity-30";

function PricePanel({ hint, initial, onApply }: { hint: string; initial: SearchFilters; onApply: (range: SearchFilters) => void }) {
  const t = useTranslations("Search");
  const [min, setMin] = useState(initial.minPrice ? String(initial.minPrice) : "");
  const [max, setMax] = useState(initial.maxPrice ? String(initial.maxPrice) : "");
  const toNumber = (value: string) => {
    const n = Number(value.replace(/\D/g, ""));
    return n > 0 ? n : undefined;
  };
  const field = (id: string, label: string, value: string, set: (v: string) => void) => (
    <div className="flex flex-1 flex-col gap-0.5 rounded-xl border border-line px-3 py-2 transition-colors focus-within:border-primary">
      <label htmlFor={id} className="text-xs font-semibold text-muted">
        {label}
      </label>
      <span className="flex items-baseline gap-1 text-sm">
        <span className="text-muted">RWF</span>
        <input
          id={id}
          inputMode="numeric"
          value={value}
          onChange={(event) => set(event.target.value.replace(/\D/g, ""))}
          className="w-full min-w-0 bg-transparent font-semibold text-ink tabular-nums outline-none"
          placeholder="0"
        />
      </span>
    </div>
  );
  const minId = useId();
  const maxId = useId();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{hint}</p>
      <div className="flex items-center gap-2">
        {field(minId, t("minPrice"), min, setMin)}
        <span className="text-muted" aria-hidden="true">
          –
        </span>
        {field(maxId, t("maxPrice"), max, setMax)}
      </div>
      <div className="flex items-center justify-between">
        <button type="button" disabled={!min && !max} onClick={() => (setMin(""), setMax(""))} className={CLEAR}>
          {t("clear")}
        </button>
        <button type="button" onClick={() => onApply({ minPrice: toNumber(min), maxPrice: toNumber(max) })} className={APPLY}>
          {t("apply")}
        </button>
      </div>
    </div>
  );
}

function TypePanel({ labels, initial, onApply }: { labels: (type: PlaceType) => string; initial: PlaceType[]; onApply: (types: PlaceType[]) => void }) {
  const t = useTranslations("Search");
  const [chosen, setChosen] = useState<PlaceType[]>(initial);
  const toggle = (type: PlaceType) =>
    setChosen((current) => (current.includes(type) ? current.filter((x) => x !== type) : PLACE_TYPES.filter((x) => x === type || current.includes(x))));
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1">
        {PLACE_TYPES.map((type) => {
          const checked = chosen.includes(type);
          return (
            <li key={type}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-canvas">
                <input type="checkbox" checked={checked} onChange={() => toggle(type)} className="peer sr-only" />
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 items-center justify-center rounded-md border transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
                    checked ? "border-primary bg-primary text-white" : "border-line-strong bg-surface",
                  )}
                >
                  {checked && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="text-[15px] text-ink">{labels(type)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between">
        <button type="button" disabled={chosen.length === 0} onClick={() => setChosen([])} className={CLEAR}>
          {t("clear")}
        </button>
        <button type="button" onClick={() => onApply(chosen)} className={APPLY}>
          {t("apply")}
        </button>
      </div>
    </div>
  );
}

const BEDROOM_CHOICES = [0, 1, 2, 3, 4, 5] as const;

/** Bedrooms (at least) and amenities (all of them). */
function MorePanel({
  amenityLabel,
  initial,
  onApply,
}: {
  amenityLabel: (a: Amenity) => string;
  initial: SearchFilters;
  onApply: (more: Pick<SearchFilters, "bedrooms" | "amenities">) => void;
}) {
  const t = useTranslations("Search");
  const [bedrooms, setBedrooms] = useState(initial.bedrooms ?? 0);
  const [amenities, setAmenities] = useState<Amenity[]>(initial.amenities ?? []);
  const toggle = (a: Amenity) => setAmenities((current) => (current.includes(a) ? current.filter((x) => x !== a) : AMENITIES.filter((x) => x === a || current.includes(x))));
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">{t("bedrooms")}</p>
        <div role="radiogroup" aria-label={t("bedrooms")} className="flex flex-wrap gap-2">
          {BEDROOM_CHOICES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={bedrooms === n}
              onClick={() => setBedrooms(n)}
              className={cn(
                "min-w-12 rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-200",
                bedrooms === n ? "border-primary bg-primary/[0.08] font-semibold text-primary" : "border-line text-ink hover:border-primary/60",
              )}
            >
              {n === 0 ? t("any") : n === 5 ? "5+" : n}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-ink">{t("amenities")}</p>
        <ul className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto">
          {AMENITIES.map((a) => {
            const checked = amenities.includes(a);
            return (
              <li key={a}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-canvas">
                  <input type="checkbox" checked={checked} onChange={() => toggle(a)} className="peer sr-only" />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary",
                      checked ? "border-primary bg-primary text-white" : "border-line-strong bg-surface",
                    )}
                  >
                    {checked && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className="text-sm text-ink">{amenityLabel(a)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex items-center justify-between">
        <button type="button" disabled={bedrooms === 0 && amenities.length === 0} onClick={() => (setBedrooms(0), setAmenities([]))} className={CLEAR}>
          {t("clear")}
        </button>
        <button type="button" onClick={() => onApply({ bedrooms: bedrooms || undefined, amenities: amenities.length ? amenities : undefined })} className={APPLY}>
          {t("apply")}
        </button>
      </div>
    </div>
  );
}
