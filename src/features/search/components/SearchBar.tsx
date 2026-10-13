"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { todayISO, type DateRange } from "@/features/search/date-range";
import { totalGuests, type GuestCounts } from "@/features/search/guests";
import { buildSearchQuery, type SearchMode } from "@/features/search/params";
import { useSearchState, type SearchPanel } from "@/features/search/search-store";
import { useSearchSummaries } from "@/features/search/use-search-summaries";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { useModal } from "@/lib/use-modal";
import { DatePanel } from "./DatePanel";
import { GuestPanel } from "./GuestPanel";
import { LocationPanel, optionId, type Suggestion } from "./LocationPanel";

export type { SearchPanel };
type Panel = SearchPanel;

/** Wraps the home-page search; the header shows a compact search once this scrolls out of view. */
export const HERO_SEARCH_ID = "hero-search";

const NO_GUESTS: GuestCounts = { adults: 0, children: 0, pets: 0 };
// Desktop dropdown position per segment: Where on the left, When full width, Who on the right.
const PANEL_WIDTH = "26rem";
const PANEL_BOX: Record<Panel, { left: string; width: string }> = {
  where: { left: "0px", width: PANEL_WIDTH },
  when: { left: "0px", width: "100%" },
  who: { left: `calc(100% - ${PANEL_WIDTH})`, width: PANEL_WIDTH },
};
// Must match the md:gap-2 between segments (0.5rem).
const SEGMENT_GAP_PX = 8;

export function SearchBar({
  today = todayISO(),
  id,
  initialOpen = null,
  onClose,
}: {
  today?: string;
  id?: string;
  /** Panel to open on mount (used by the header search). */
  initialOpen?: Panel | null;
  /** Called whenever the open panel is dismissed (Esc, outside click, search, Done). */
  onClose?: () => void;
}) {
  const t = useTranslations("Home");
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const whereInputRef = useRef<HTMLInputElement>(null);

  // Entered values live in a shared store so the hero and header searches stay in sync.
  const [search, setSearch] = useSearchState();
  const { mode, location, range, flex, guests } = search;
  const setMode = (value: SearchMode) => setSearch({ mode: value });
  const setLocation = (value: string) => setSearch({ location: value });
  const setRange = (value: DateRange) => setSearch({ range: value });
  const setFlex = (value: number) => setSearch({ flex: value });
  const setGuests = (value: GuestCounts) => setSearch({ guests: value });
  const { whenSummary, whoSummary } = useSearchSummaries(search);

  const [open, setOpen] = useState<Panel | null>(initialOpen);
  // Panel to move keyboard focus into once it is open (set when opened programmatically).
  const [focusPanel, setFocusPanel] = useState<Panel | null>(initialOpen);
  // Where combobox: suggestions from the API and the option highlighted with the arrow keys.
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const receiveSuggestions = useCallback((list: Suggestion[]) => {
    setSuggestions(list);
    setActiveIndex(-1);
  }, []);
  // Where the shared highlight sits; kept after closing so the next open fades in place.
  const [highlightAt, setHighlightAt] = useState<Panel>(initialOpen ?? "where");
  // Segment under the mouse; the bordered hover pill slides to it. Kept on leave so it fades in place.
  const [hovered, setHovered] = useState<Panel | null>(null);
  const [hoverAt, setHoverAt] = useState<Panel>("where");

  // Desktop bar is compact and white at rest, and expands while hovered, focused or open.
  const [barHover, setBarHover] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const expanded = barHover || focusWithin || open !== null;

  function hover(panel: Panel | null) {
    setHovered(panel);
    if (panel) setHoverAt(panel);
  }

  // Latest onClose without re-subscribing listeners on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const close = useCallback(() => {
    setOpen(null);
    setFocusPanel(null);
    onCloseRef.current?.();
  }, []);

  function openPanel(panel: Panel | null) {
    if (!panel) return close();
    setOpen(panel);
    setHighlightAt(panel);
    setFocusPanel(null);
  }

  // Opened programmatically (initialOpen, or the header pill): move keyboard focus into the field or panel.
  // preventScroll keeps the header's smooth scroll from being cut short.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusPanel || open !== focusPanel) return;
    if (focusPanel === "where") whereInputRef.current?.focus({ preventScroll: true });
    else panelRef.current?.querySelector<HTMLElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [focusPanel, open]);

  // The hero search answers "open this panel" requests from the header pill
  // (handled during render, React's pattern for responding to a changed value).
  const openRequest = search.openRequest;
  const [handledRequestAt, setHandledRequestAt] = useState<number | null>(null);
  if (id === HERO_SEARCH_ID && openRequest && openRequest.at !== handledRequestAt) {
    setHandledRequestAt(openRequest.at);
    setOpen(openRequest.panel);
    setHighlightAt(openRequest.panel);
    setFocusPanel(openRequest.panel);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    const onPointer = (event: PointerEvent) => {
      if (isDesktop && !rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, isDesktop, close]);

  const short = mode === "short";
  const people = totalGuests(guests);

  function submit() {
    close();
    router.push({
      pathname: "/search",
      query: buildSearchQuery(mode, {
        location,
        checkIn: range.checkIn,
        checkOut: range.checkOut,
        guests: people,
        pets: guests.pets,
        flex: range.checkIn ? flex : 0,
      }),
    });
  }

  function pickLocation(city: string) {
    setLocation(city);
    openPanel(short && isDesktop ? "when" : null);
  }

  const panels: Record<Panel, ReactNode> = {
    where: (
      <LocationPanel
        id={listboxId}
        text={location}
        suggestions={suggestions}
        activeIndex={activeIndex}
        onSuggestions={receiveSuggestions}
        onPick={pickLocation}
      />
    ),
    when: <DatePanel today={today} range={range} flex={flex} onRangeChange={setRange} onFlexChange={setFlex} />,
    who: <GuestPanel counts={guests} onChange={setGuests} />,
  };
  const clear: Record<Panel, () => void> = {
    where: () => setLocation(""),
    when: () => {
      setRange({});
      setFlex(0);
    },
    who: () => setGuests(NO_GUESTS),
  };

  const order: Panel[] = short ? ["where", "when", "who"] : ["where"];
  const highlightIndex = Math.max(0, order.indexOf(highlightAt));
  const showHighlight = Boolean(open && isDesktop);

  const hoverIndex = Math.max(0, order.indexOf(hoverAt));
  const showHover = Boolean(hovered && isDesktop);

  // Width and offset of a pill covering segment `index`, accounting for the gap between segments.
  const pillStyle = (index: number) => ({
    width: `calc((100% - ${(order.length - 1) * SEGMENT_GAP_PX}px) / ${order.length})`,
    transform: `translateX(calc(${index * 100}% + ${index * SEGMENT_GAP_PX}px))`,
  });

  const segmentClass = cn(
    "relative z-10 flex flex-col justify-center rounded-xl border border-line-strong px-4 py-3 text-left",
    "transition-[padding,color] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none",
    // Phones have no hover, so fields stay outlined there; on desktop the sliding pills mark the segment.
    "md:rounded-full md:border-transparent md:px-6",
    expanded ? "md:py-3" : "md:py-2",
  );

  const pillMotion = "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none";

  return (
    // Only while expanded does the search rise above the sticky header (z-40); at rest it scrolls under it.
    <div ref={rootRef} id={id} className={cn("relative flex w-full max-w-4xl flex-col gap-4", expanded ? "z-50" : "z-0")}>
      {/* Blurs and slightly dims the rest of the page while the bar is expanded (desktop). Clicks pass through. */}
      <div
        data-testid="page-blur"
        data-visible={expanded}
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-0 hidden bg-black/15 backdrop-blur-[6px] md:block",
          "transition-opacity duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none",
          expanded ? "opacity-100" : "opacity-0",
        )}
      />
      <SegmentedTabs
        label={t("modeLabel")}
        value={mode}
        onChange={(value) => {
          setMode(value);
          setOpen(null);
        }}
        options={[
          { value: "short", label: t("short") },
          { value: "long", label: t("long") },
        ]}
        // Pro edge matching the search bar: blue hairline, frosted halo, soft floating shadow.
        className="relative border border-primary/80 shadow-[0_12px_32px_-14px_rgba(0,30,80,0.55)] ring-[5px] ring-white/20 md:max-w-md md:self-center"
      />

      {/* Reserves the expanded bar height so growing on hover never shifts the page. */}
      <div className="relative md:flex md:h-[82px] md:items-center">
      <form
        role="search"
        data-expanded={expanded}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        onMouseEnter={() => setBarHover(true)}
        onMouseLeave={() => setBarHover(false)}
        onFocus={() => setFocusWithin(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false);
        }}
        className={cn(
          "flex flex-col gap-2 rounded-card border border-primary bg-surface p-5 shadow-sm",
          // Desktop: crisp white hairline, soft frosted halo and a deep floating shadow.
          "md:mx-auto md:w-full md:flex-row md:items-center md:gap-0 md:rounded-full md:border md:border-white/80",
          "md:ring-[6px] md:ring-white/20 md:shadow-[0_24px_60px_-18px_rgba(0,18,48,0.6),0_2px_6px_rgba(0,18,48,0.12)]",
          "md:transition-[max-width,padding,background-color] md:duration-500 md:ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none",
          // Compact white bar at rest; wider, taller, mid-light grey while in use.
          expanded ? "md:max-w-4xl md:bg-[#cfd2d6] md:p-2" : "md:max-w-3xl md:bg-surface md:p-1",
        )}
      >
        <div
          className={cn("relative grid flex-1 gap-3 md:gap-2", short ? "md:grid-cols-3" : "md:grid-cols-1")}
          onMouseLeave={() => hover(null)}
        >
        <span
          data-testid="segment-highlight"
          data-visible={showHighlight}
          aria-hidden="true"
          style={pillStyle(highlightIndex)}
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 hidden rounded-full bg-surface shadow-lg md:block",
            pillMotion,
            showHighlight ? "opacity-100" : "opacity-0",
          )}
        />
        <span
          data-testid="hover-pill"
          data-visible={showHover}
          aria-hidden="true"
          style={pillStyle(hoverIndex)}
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 hidden rounded-full bg-black/10 md:block",
            pillMotion,
            showHover ? "opacity-100" : "opacity-0",
          )}
        />
        <div className={segmentClass} onMouseEnter={() => hover("where")}>
          <label htmlFor={`${listboxId}-input`} className="text-xs font-semibold text-ink">
            {t("where")}
          </label>
          <input
            ref={whereInputRef}
            id={`${listboxId}-input`}
            role="combobox"
            aria-expanded={open === "where"}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={open === "where" && activeIndex >= 0 ? optionId(listboxId, activeIndex) : undefined}
            onKeyDown={(event) => {
              const count = suggestions?.length ?? 0;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                openPanel("where");
                if (count === 0) return;
                const step = event.key === "ArrowDown" ? 1 : -1;
                setActiveIndex((i) => (i < 0 && step < 0 ? count - 1 : (i + step + count) % count));
              } else if (event.key === "Enter" && open === "where" && activeIndex >= 0 && suggestions?.[activeIndex]) {
                // Enter on a highlighted suggestion picks it instead of submitting the search.
                event.preventDefault();
                pickLocation(suggestions[activeIndex].city);
              }
            }}
            autoComplete="off"
            value={location}
            placeholder={t("wherePlaceholder")}
            onFocus={() => openPanel("where")}
            onClick={() => openPanel("where")}
            onChange={(event) => {
              setLocation(event.target.value);
              setActiveIndex(-1);
              openPanel("where");
            }}
            className="w-full bg-transparent text-[15px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted md:placeholder:text-[#4a4e54]"
          />
        </div>

        {short && (
          <>
            <button type="button" className={segmentClass} onMouseEnter={() => hover("when")} aria-expanded={open === "when"} onClick={() => openPanel(open === "when" ? null : "when")}>
              <span className="text-xs font-semibold text-ink">{t("when")}</span>
              <span className={cn("text-[15px] font-medium", whenSummary ? "text-ink" : "text-muted md:text-[#4a4e54]")}>
                {whenSummary ?? t("whenPlaceholder")}
              </span>
            </button>
            <button type="button" className={segmentClass} onMouseEnter={() => hover("who")} aria-expanded={open === "who"} onClick={() => openPanel(open === "who" ? null : "who")}>
              <span className="text-xs font-semibold text-ink">{t("who")}</span>
              <span className={cn("text-[15px] font-medium", whoSummary ? "text-ink" : "text-muted md:text-[#4a4e54]")}>
                {whoSummary ?? t("whoPlaceholder")}
              </span>
            </button>
          </>
        )}
        </div>

        <button
          type="submit"
          className={cn(
            "mt-3 flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-white hover:bg-primary-hover",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:mt-0 md:ml-2",
            "transition-[height,padding,gap,background-color] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none",
            // Icon only at rest; icon + word while the bar is in use. The word stays in the accessible name.
            !expanded && "md:h-11 md:gap-0 md:px-3.5",
          )}
        >
          <Search className="size-4 shrink-0" aria-hidden="true" />
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none",
              expanded ? "max-w-32 opacity-100" : "max-w-32 opacity-100 md:max-w-0 md:opacity-0",
            )}
          >
            {t("search")}
          </span>
        </button>
      </form>
      </div>

      {open && isDesktop && (
        // One persistent panel: it slides and resizes with the white pill instead of re-mounting per segment.
        <div
          ref={panelRef}
          data-testid="search-panel"
          style={PANEL_BOX[open]}
          className={cn(
            "absolute top-full z-30 mt-3 rounded-[2rem] bg-surface p-8 shadow-[0_18px_50px_rgba(0,0,0,0.28),0_4px_14px_rgba(0,0,0,0.14)] motion-safe:animate-pop-in",
            "transition-[left,width] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none",
          )}
        >
          {panels[open]}
        </div>
      )}

      {open && !isDesktop && (
        <MobileSheet
          title={t(open)}
          closeLabel={t("close")}
          clearLabel={t("clear")}
          doneLabel={t("done")}
          onClose={close}
          onClear={clear[open]}
        >
          {open === "where" && (
            <input
              aria-label={t("where")}
              autoFocus
              value={location}
              placeholder={t("wherePlaceholder")}
              onChange={(event) => setLocation(event.target.value)}
              className="mb-4 w-full rounded-full border border-line px-5 py-3 text-base outline-none focus:border-primary"
            />
          )}
          {panels[open]}
        </MobileSheet>
      )}
    </div>
  );
}

function MobileSheet({
  title,
  closeLabel,
  clearLabel,
  doneLabel,
  onClose,
  onClear,
  children,
}: {
  title: string;
  closeLabel: string;
  clearLabel: string;
  doneLabel: string;
  onClose: () => void;
  onClear: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Modal behaviour (focus inside, Tab trapped, scroll lock, focus restored); Escape is handled by SearchBar.
  useModal(sheetRef);

  return (
    <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-50 flex flex-col bg-surface motion-safe:animate-sheet-up">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 id={titleId} className="text-lg font-bold tracking-[-0.01em]">
          {title}
        </h2>
        <button type="button" aria-label={closeLabel} onClick={onClose} className="flex size-10 items-center justify-center rounded-full hover:bg-canvas">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">{children}</div>
      <div className="flex items-center justify-between border-t border-line px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <button type="button" onClick={onClear} className="text-sm font-medium text-muted underline">
          {clearLabel}
        </button>
        <button type="button" onClick={onClose} className="rounded-full bg-primary px-8 py-3 font-semibold text-white hover:bg-primary-hover">
          {doneLabel}
        </button>
      </div>
    </div>
  );
}
