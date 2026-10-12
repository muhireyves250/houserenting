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
}: {
  today: ISODate;
  range: DateRange;
  flex: number;
  onRangeChange: (range: DateRange) => void;
  onFlexChange: (days: number) => void;
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

  return (
    <div className="flex flex-col gap-6" data-calendar>
      <div className="relative grid gap-8 md:grid-cols-2">
        <button
          type="button"
          aria-label={t("prevMonth")}
          disabled={atFirstMonth}
          onClick={() => setBase(addMonths(base.year, base.month, -1))}
          className="absolute top-0 left-0 flex size-8 items-center justify-center rounded-full hover:bg-canvas disabled:opacity-30"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={t("nextMonth")}
          onClick={() => setBase(addMonths(base.year, base.month, 1))}
          className="absolute top-0 right-0 flex size-8 items-center justify-center rounded-full hover:bg-canvas"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>

        {months.map(({ year, month }) => (
          <div key={`${year}-${month}`} className="flex flex-col gap-3">
            <h3 className="text-center text-base font-semibold">{monthLabel.format(Date.UTC(year, month, 1))}</h3>
            <table className="w-full table-fixed border-collapse text-center text-sm">
              <thead>
                <tr>
                  {weekdays.map((d, i) => (
                    <th key={i} scope="col" className="pb-2 text-xs font-medium text-muted">
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
                            disabled={past}
                            onClick={() => onRangeChange(pickDate(range, day))}
                            onKeyDown={(event) => moveFocus(event, day)}
                            className={cn(
                              "mx-auto flex size-10 items-center justify-center rounded-full text-sm transition-colors",
                              "focus-visible:outline-2 focus-visible:outline-primary",
                              past ? "cursor-not-allowed text-line" : "hover:border hover:border-ink",
                              isEdge && "bg-primary font-semibold text-white hover:border-transparent",
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

      <div role="radiogroup" aria-label={t("when")} className="flex flex-wrap justify-center gap-2">
        {FLEX_OPTIONS.map((days) => (
          <button
            key={days}
            type="button"
            role="radio"
            aria-checked={flex === days}
            onClick={() => onFlexChange(days)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              flex === days ? "border-ink bg-canvas font-medium" : "border-line hover:border-ink",
            )}
          >
            {days === 0 ? t("exactDates") : t("flexDays", { days })}
          </button>
        ))}
      </div>
    </div>
  );
}
