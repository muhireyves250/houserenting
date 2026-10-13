"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { todayISO } from "@/features/search/date-range";
import { totalGuests } from "@/features/search/guests";
import { buildSearchQuery } from "@/features/search/params";
import { useSearchState, type SearchPanel } from "@/features/search/search-store";
import { useSearchSummaries } from "@/features/search/use-search-summaries";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { useModal } from "@/lib/use-modal";
import { DatePanel } from "./DatePanel";
import { GuestPanel } from "./GuestPanel";
import { LocationPanel, type Suggestion } from "./LocationPanel";

/**
 * Phones: "Start your search" pill that opens a full-screen sheet with stacked Where? / When? / Who?
 * cards (one open at a time, the others collapsed to a summary), Clear all and Search at the bottom.
 * Shares the search store with the desktop search, so both always show the same values.
 */
export function MobileSearch({
  today = todayISO(),
  className,
  results = false,
}: {
  today?: string;
  className?: string;
  /** Results page: "Homes in Kigali" over the dates and guests, centred. */
  results?: boolean;
}) {
  const t = useTranslations("Home");
  const tSearch = useTranslations("Search");
  const [search] = useSearchState();
  const { whenSummary, whoSummary } = useSearchSummaries(search);
  const [open, setOpen] = useState(false);
  const details = [whenSummary ?? t("compactWhen"), whoSummary ?? t("whoPlaceholder")].join(" · ");
  const chosen = Boolean(search.location || whenSummary || whoSummary);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={chosen || results ? undefined : t("startSearch")}
        className={cn(
          "flex h-14 w-full items-center justify-center gap-3 rounded-full bg-surface px-5 shadow-[0_6px_20px_-6px_rgba(16,24,40,0.25)] ring-1 ring-black/[0.06] transition-transform duration-300 active:scale-[0.98]",
          className,
        )}
      >
        {!results && <Search className="size-[18px] shrink-0 text-ink" strokeWidth={2.4} aria-hidden="true" />}
        {results ? (
          <span className="min-w-0 text-center">
            <span className="block truncate text-[15px] font-semibold text-ink">
              {tSearch("title", { place: search.location || t("country") })}
            </span>
            <span className="block truncate text-[13px] text-muted">{details}</span>
          </span>
        ) : chosen ? (
          <span className="min-w-0 text-left">
            <span className="block truncate text-sm font-semibold text-ink">{search.location || t("compactWhere")}</span>
            <span className="block truncate text-xs text-muted">{details}</span>
          </span>
        ) : (
          <span className="text-[15px] font-semibold text-ink">{t("startSearch")}</span>
        )}
      </button>
      {open && createPortal(<SearchSheet today={today} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function SearchSheet({ today, onClose }: { today: string; onClose: () => void }) {
  const t = useTranslations("Home");
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const listboxId = useId();
  useModal(ref, onClose);

  const [search, setSearch] = useSearchState();
  const { mode, location, range, flex, guests } = search;
  const { whenSummary, whoSummary } = useSearchSummaries(search);
  const short = mode === "short";
  const [step, setStep] = useState<SearchPanel>("where");
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const receive = useCallback((list: Suggestion[]) => setSuggestions(list), []);

  function submit() {
    onClose();
    router.push({
      pathname: "/search",
      query: buildSearchQuery(mode, {
        location,
        checkIn: range.checkIn,
        checkOut: range.checkOut,
        guests: totalGuests(guests),
        pets: guests.pets,
        flex: range.checkIn ? flex : 0,
      }),
    });
  }

  function clearAll() {
    setSearch({ location: "", range: {}, flex: 0, guests: { adults: 0, children: 0, pets: 0 } });
    setStep("where");
  }

  const card = "rounded-3xl bg-surface shadow-[0_10px_30px_-12px_rgba(16,24,40,0.25)] ring-1 ring-black/[0.04]";
  const collapsed = (panel: SearchPanel, label: string, value: string, placeholder: boolean) => (
    <button
      type="button"
      onClick={() => setStep(panel)}
      aria-label={`${label} ${value}`}
      className={cn(card, "flex w-full items-center justify-between gap-4 px-5 py-4 text-left motion-safe:animate-pop-in")}
    >
      <span className="text-sm text-muted">{label}</span>
      <span className={cn("truncate text-sm font-semibold", placeholder ? "text-ink/70" : "text-ink")}>{value}</span>
    </button>
  );
  const expanded = (heading: string, body: ReactNode) => (
    <section className={cn(card, "p-5 motion-safe:animate-pop-in")}>
      <h3 className="mb-4 text-[22px] font-bold tracking-[-0.02em] text-ink">{heading}</h3>
      {body}
    </section>
  );

  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-[60] flex flex-col bg-canvas motion-safe:animate-sheet-up">
      <h2 id={titleId} className="sr-only">
        {t("startSearch")}
      </h2>
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <SegmentedTabs
          label={t("modeLabel")}
          value={mode}
          onChange={(value) => {
            setSearch({ mode: value });
            setStep("where");
          }}
          options={[
            { value: "short", label: t("short") },
            { value: "long", label: t("long") },
          ]}
          className="flex-1 border border-line bg-surface"
        />
        <button
          type="button"
          aria-label={t("closeSearch")}
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface shadow-sm ring-1 ring-line transition-transform active:scale-90"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6" data-lenis-prevent>
        <div className="flex flex-col gap-3">
          {step === "where"
            ? expanded(
                t("whereQ"),
                <>
                  <label className="mb-4 flex items-center gap-3 rounded-2xl border border-line-strong px-4 py-3 focus-within:border-ink">
                    <Search className="size-5 text-ink" aria-hidden="true" />
                    <span className="sr-only">{t("where")}</span>
                    <input
                      role="combobox"
                      aria-label={t("where")}
                      aria-expanded="true"
                      aria-controls={listboxId}
                      autoComplete="off"
                      value={location}
                      placeholder={t("wherePlaceholder")}
                      onChange={(event) => setSearch({ location: event.target.value })}
                      className="w-full bg-transparent text-[15px] text-ink outline-none"
                    />
                  </label>
                  <LocationPanel
                    id={listboxId}
                    text={location}
                    suggestions={suggestions}
                    activeIndex={-1}
                    onSuggestions={receive}
                    onPick={(city) => {
                      setSearch({ location: city });
                      setStep(short ? "when" : "where");
                    }}
                  />
                </>,
              )
            : collapsed("where", t("where"), location || t("compactWhere"), !location)}

          {short &&
            (step === "when"
              ? expanded(
                  t("whenQ"),
                  <DatePanel
                    today={today}
                    range={range}
                    flex={flex}
                    onRangeChange={(value) => setSearch({ range: value })}
                    onFlexChange={(value) => setSearch({ flex: value })}
                  />,
                )
              : collapsed("when", t("when"), whenSummary ?? t("whenPlaceholder"), !whenSummary))}

          {short &&
            (step === "who"
              ? expanded(t("whoQ"), <GuestPanel counts={guests} onChange={(value) => setSearch({ guests: value })} />)
              : collapsed("who", t("who"), whoSummary ?? t("whoPlaceholder"), !whoSummary))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line bg-surface px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button type="button" onClick={clearAll} className="text-[15px] font-semibold text-ink underline underline-offset-4">
          {t("clearAll")}
        </button>
        <button
          type="button"
          onClick={submit}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(0,87,184,0.8)] transition-transform active:scale-[0.97]"
        >
          <Search className="size-4" aria-hidden="true" />
          {t("search")}
        </button>
      </div>
    </div>
  );
}
