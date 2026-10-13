"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import { addMonths, inRange, monthGrid, pickDate, type DateRange, type ISODate } from "@/features/search/date-range";
import { cn } from "@/lib/cn";

const FLEX_OPTIONS = [0, 1, 2, 3] as const;
// 2026-10-11 is a Sunday; used to label weekday columns.
const A_SUNDAY = Date.UTC(2026, 9, 11);
const DAY_MS = 24 * 60 * 60 * 1000;

const utc = (iso: ISODate) => new Date(`${iso}T00:00:00Z`);

export function DatePanel({
  today,
  range,
  flex,
  onRangeChange,
  onFlexChange,
  showFlex = true,
}: {
  today: ISODate;
  range: DateRange;
  flex: number;
  onRangeChange: (range: DateRange) => void;
  onFlexChange: (days: number) => void;
  /** The "± days" flexibility chips (search only; a listing's calendar books exact dates). */
  showFlex?: boolean;
}) {
  const t = useTranslations("Home");
  const locale = useLocale();
  const [todayYear, todayMonth] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1];
  const [base, setBase] = useState({ year: todayYear, month: todayMonth });
  const atFirstMonth = base.year === todayYear && base.month === todayMonth;

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const dayLabel = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  const weekdays = Array.from({ length: 7 }, (_, i) => weekday.format(A_SUNDAY + i * DAY_MS));

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, day: ISODate) {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!step) return;
    event.preventDefault();
    const target = new Date(utc(day).getTime() + step * DAY_MS).toISOString().slice(0, 10);
    const grid = event.currentTarget.closest("[data-calendar]");
    grid?.querySelector<HTMLButtonElement>(`[data-date="${target}"]:not(:disabled)`)?.focus();
  }

  const months = [base, addMonths(base.year, base.month, 1)];
  const shortDate = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const nights =
    range.checkIn && range.checkOut ? Math.round((utc(range.checkOut).getTime() - utc(range.checkIn).getTime()) / DAY_MS) : 0;

  return (
    <div className="flex flex-col gap-6" data-calendar>
      <div className="relative grid gap-8 md:grid-cols-2">
        <button
          type="button"
          aria-label={t("prevMonth")}
          disabled={atFirstMonth}
          onClick={() => setBase(addMonths(base.year, base.month, -1))}
          className="absolute top-0 left-0 flex size-9 items-center justify-center rounded-full border border-line text-ink transition-colors duration-200 hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={t("nextMonth")}
          onClick={() => setBase(addMonths(base.year, base.month, 1))}
          className="absolute top-0 right-0 flex size-9 items-center justify-center rounded-full border border-line text-ink transition-colors duration-200 hover:border-primary hover:text-primary"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>

        {months.map(({ year, month }) => (
          <div key={`${year}-${month}`} className="flex flex-col gap-3">
            <h3 className="pt-1.5 text-center text-[15px] font-bold tracking-tight text-ink">{monthLabel.format(Date.UTC(year, month, 1))}</h3>
            <table className="w-full table-fixed border-collapse text-center text-sm">
              <thead>
                <tr>
                  {weekdays.map((d, i) => (
                    <th key={i} scope="col" className="pb-3 text-xs font-semibold text-muted">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthGrid(year, month).map((week, w) => (
                  <tr key={w}>
                    {week.map((day, d) => {
                      if (!day) return <td key={d} />;
                      const past = day < today;
                      const isEdge = day === range.checkIn || day === range.checkOut;
                      const between = inRange(range, day);
                      return (
                        <td key={d} className={cn("p-0", between && "bg-primary-soft", day === range.checkIn && range.checkOut && "rounded-l-full bg-primary-soft", day === range.checkOut && "rounded-r-full bg-primary-soft")}>
                          <button
                            type="button"
                            data-date={day}
                            aria-label={dayLabel.format(utc(day))}
                            aria-pressed={isEdge}
                            aria-current={day === today ? "date" : undefined}
                            disabled={past}
                            onClick={() => onRangeChange(pickDate(range, day))}
                            onKeyDown={(event) => moveFocus(event, day)}
                            className={cn(
                              "relative mx-auto flex size-10 items-center justify-center rounded-full text-sm font-medium transition-[background-color,box-shadow,color] duration-200",
                              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
                              past ? "cursor-not-allowed text-ink/25" : "text-ink hover:ring-2 hover:ring-primary/40",
                              // Today: bold with a small dot underneath.
                              day === today && "font-bold after:absolute after:bottom-1 after:size-1 after:rounded-full after:bg-primary",
                              isEdge &&
                                "bg-primary font-semibold text-white shadow-[0_6px_14px_-6px_rgba(0,87,184,0.85)] after:bg-white hover:ring-0",
                            )}
                          >
                            {Number(day.slice(8))}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {showFlex && (
      <div role="radiogroup" aria-label={t("when")} className="flex flex-wrap justify-center gap-2">
        {FLEX_OPTIONS.map((days) => (
          <button
            key={days}
            type="button"
            role="radio"
            aria-checked={flex === days}
            onClick={() => onFlexChange(days)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors duration-200",
              flex === days
                ? "border-primary bg-primary/[0.08] font-semibold text-primary"
                : "border-line text-ink hover:border-primary/60",
            )}
          >
            {days === 0 ? t("exactDates") : t("flexDays", { days })}
          </button>
        ))}
      </div>
      )}

      {/* Summary of the chosen stay and a quick way to start over. */}
      <div className="flex items-center justify-between border-t border-line pt-4">
        <p className="text-sm text-muted" aria-live="polite">
          {nights > 0 && range.checkIn && range.checkOut && (
            <>
              <span className="font-semibold text-ink">{t("nights", { count: nights })}</span>
              {" · "}
              {shortDate.format(utc(range.checkIn))} – {shortDate.format(utc(range.checkOut))}
            </>
          )}
        </p>
        <button
          type="button"
          disabled={!range.checkIn}
          onClick={() => {
            onRangeChange({});
            onFlexChange(0);
          }}
          className="text-sm font-semibold text-ink underline underline-offset-4 transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-30"
        >
          {t("clearDates")}
        </button>
      </div>
    </div>
  );
}
