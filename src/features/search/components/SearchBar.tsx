"use client";

import { Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { todayISO, type DateRange } from "@/features/search/date-range";
import { totalGuests, type GuestCounts } from "@/features/search/guests";
import { buildSearchQuery, type SearchMode } from "@/features/search/params";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { DatePanel } from "./DatePanel";
import { GuestPanel } from "./GuestPanel";
import { LocationPanel } from "./LocationPanel";

type Panel = "where" | "when" | "who";

const NO_GUESTS: GuestCounts = { adults: 0, children: 0, pets: 0 };
// Must match the md:gap-2 between segments (0.5rem).
const SEGMENT_GAP_PX = 8;

export function SearchBar({ today = todayISO() }: { today?: string }) {
  const t = useTranslations("Home");
  const locale = useLocale();
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const [mode, setMode] = useState<SearchMode>("short");
  const [open, setOpen] = useState<Panel | null>(null);
  const [location, setLocation] = useState("");
  const [range, setRange] = useState<DateRange>({});
  const [flex, setFlex] = useState(0);
  const [guests, setGuests] = useState<GuestCounts>(NO_GUESTS);
  // Where the shared highlight sits; kept after closing so the next open fades in place.
  const [highlightAt, setHighlightAt] = useState<Panel>("where");
  // Segment under the mouse; the bordered hover pill slides to it. Kept on leave so it fades in place.
  const [hovered, setHovered] = useState<Panel | null>(null);
  const [hoverAt, setHoverAt] = useState<Panel>("where");

  function hover(panel: Panel | null) {
    setHovered(panel);
    if (panel) setHoverAt(panel);
  }

  function openPanel(panel: Panel | null) {
    setOpen(panel);
    if (panel) setHighlightAt(panel);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(null);
    const onPointer = (event: PointerEvent) => {
      if (isDesktop && !rootRef.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, isDesktop]);

  const short = mode === "short";
  const shortDate = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const fmt = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`));
  const whenSummary = range.checkIn
    ? [fmt(range.checkIn), range.checkOut && fmt(range.checkOut)].filter(Boolean).join(" – ") + (flex ? ` (${t("flexDays", { days: flex })})` : "")
    : null;
  const people = totalGuests(guests);
  const whoSummary = people
    ? [t("guestsSummary", { count: people }), guests.pets ? t("petsSummary", { count: guests.pets }) : null].filter(Boolean).join(", ")
    : null;

  function submit() {
    setOpen(null);
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
    where: <LocationPanel id={listboxId} text={location} onPick={pickLocation} />,
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

  const segment = (panel: Panel) =>
    cn(
      "relative z-10 flex flex-col justify-center rounded-xl border border-line-strong px-4 py-3 text-left transition-colors duration-500",
      // Phones have no hover, so fields stay outlined there; on desktop the sliding pills provide the outline.
      "md:rounded-full md:border-transparent md:px-6",
      // While another segment is hovered, outline and dim this one; the hovered one sits on the white pill.
      hovered && hovered !== panel && open !== panel && "md:border-line-strong md:bg-ink/[0.06]",
    );

  const pillMotion = "transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] motion-reduce:transition-none";

  return (
    <div ref={rootRef} className="relative flex w-full max-w-4xl flex-col gap-4">
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
        className="md:max-w-md md:self-center"
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className={cn(
          "flex flex-col gap-2 rounded-card border border-line-strong bg-surface p-5 shadow-sm",
          "md:flex-row md:items-center md:gap-0 md:rounded-full md:border-transparent md:p-2",
          open ? "md:bg-canvas" : "md:bg-surface",
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
            "pointer-events-none absolute inset-y-0 left-0 hidden rounded-full bg-surface shadow-md md:block",
            pillMotion,
            showHover ? "opacity-100" : "opacity-0",
          )}
        />
        <div className={segment("where")} onMouseEnter={() => hover("where")}>
          <label htmlFor={`${listboxId}-input`} className="text-xs font-semibold text-ink">
            {t("where")}
          </label>
          <input
            id={`${listboxId}-input`}
            role="combobox"
            aria-expanded={open === "where"}
            aria-controls={listboxId}
            aria-autocomplete="list"
            autoComplete="off"
            value={location}
            placeholder={t("wherePlaceholder")}
            onFocus={() => openPanel("where")}
            onClick={() => openPanel("where")}
            onChange={(event) => {
              setLocation(event.target.value);
              openPanel("where");
            }}
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </div>

        {short && (
          <>
            <button type="button" className={segment("when")} onMouseEnter={() => hover("when")} aria-expanded={open === "when"} onClick={() => openPanel(open === "when" ? null : "when")}>
              <span className="text-xs font-semibold text-ink">{t("when")}</span>
              <span className={cn("text-sm", whenSummary ? "text-ink" : "text-muted")}>{whenSummary ?? t("whenPlaceholder")}</span>
            </button>
            <button type="button" className={segment("who")} onMouseEnter={() => hover("who")} aria-expanded={open === "who"} onClick={() => openPanel(open === "who" ? null : "who")}>
              <span className="text-xs font-semibold text-ink">{t("who")}</span>
              <span className={cn("text-sm", whoSummary ? "text-ink" : "text-muted")}>{whoSummary ?? t("whoPlaceholder")}</span>
            </button>
          </>
        )}
        </div>

        <button
          type="submit"
          className="mt-3 flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:mt-0 md:ml-2"
        >
          <Search className="size-4" aria-hidden="true" />
          {t("search")}
        </button>
      </form>

      {open && isDesktop && (
        <div
          key={open}
          className={cn(
            "absolute top-full z-30 mt-3 rounded-[2rem] bg-surface p-8 shadow-2xl motion-safe:animate-pop-in",
            open === "where" && "left-0 w-[26rem]",
            open === "when" && "inset-x-0",
            open === "who" && "right-0 w-[26rem]",
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
          onClose={() => setOpen(null)}
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
  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-50 flex flex-col bg-surface motion-safe:animate-sheet-up">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 id={titleId} className="text-lg font-semibold">
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
