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
    setOpen(short && isDesktop ? "when" : null);
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

  const segment = (panel: Panel) =>
    cn(
      "flex flex-1 flex-col justify-center rounded-full px-6 py-3 text-left transition-colors",
      "max-md:rounded-none max-md:border-b max-md:border-line max-md:px-0",
      open === panel ? "md:bg-surface md:shadow-lg" : "md:hover:bg-line/40",
    );

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
          "flex flex-col gap-2 rounded-card bg-surface p-5 shadow-sm",
          "md:flex-row md:items-center md:gap-0 md:rounded-full md:p-1.5",
          open ? "md:bg-canvas" : "md:bg-surface",
        )}
      >
        <div className={segment("where")}>
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
            onFocus={() => setOpen("where")}
            onClick={() => setOpen("where")}
            onChange={(event) => {
              setLocation(event.target.value);
              setOpen("where");
            }}
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </div>

        {short && (
          <>
            <Divider />
            <button type="button" className={segment("when")} aria-expanded={open === "when"} onClick={() => setOpen(open === "when" ? null : "when")}>
              <span className="text-xs font-semibold text-ink">{t("when")}</span>
              <span className={cn("text-sm", whenSummary ? "text-ink" : "text-muted")}>{whenSummary ?? t("whenPlaceholder")}</span>
            </button>
            <Divider />
            <button type="button" className={segment("who")} aria-expanded={open === "who"} onClick={() => setOpen(open === "who" ? null : "who")}>
              <span className="text-xs font-semibold text-ink">{t("who")}</span>
              <span className={cn("text-sm", whoSummary ? "text-ink" : "text-muted")}>{whoSummary ?? t("whoPlaceholder")}</span>
            </button>
          </>
        )}

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
          className={cn(
            "absolute top-full z-30 mt-3 rounded-[2rem] bg-surface p-8 shadow-2xl",
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

function Divider() {
  return <span className="hidden h-8 w-px bg-line md:block" aria-hidden="true" />;
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
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-0 z-50 flex flex-col bg-surface">
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
