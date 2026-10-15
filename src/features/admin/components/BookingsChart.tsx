"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/cn";

/** A clean top for the axis: 1, 2, 5 × 10^n at or above the highest day. */
function niceMax(max: number): number {
  if (max <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 5, 10].find((m) => m * power >= max) ?? 10;
  return step * power;
}

/**
 * Bookings made per day (last 30 days), one column per day in the brand blue. Hovering or focusing a day shows its
 * date and count; a table with the same numbers is there for screen readers.
 */
export function BookingsChart({ days }: { days: { day: string; count: number }[] }) {
  const t = useTranslations("Admin.dashboard");
  const locale = useLocale();
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...days.map((d) => d.count)));
  const ticks = [top, top / 2, 0];
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const shortFmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const label = (iso: string) => dayFmt.format(new Date(`${iso}T00:00:00Z`));
  const total = days.reduce((sum, d) => sum + d.count, 0);

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="text-[15px] font-semibold text-ink">{t("bookingsChart")}</span>
        <span className="text-[13px] text-muted tabular-nums">{t("bookingsTotal", { count: total })}</span>
      </figcaption>
      <div className="relative flex h-56 gap-2">
        {/* Y axis */}
        <div className="flex w-6 flex-col justify-between pb-6 text-right text-[11px] text-muted tabular-nums" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {tick}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {/* Hairline grid */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} className="h-px bg-line/70" />
            ))}
          </div>
          {/* Columns: the whole day slot is the hover target; the bar is capped at 24px, rounded at the top, square at the base. */}
          <div className="absolute inset-x-0 top-0 bottom-6 flex items-end" onMouseLeave={() => setActive(null)}>
            {days.map((d, i) => (
              <button
                key={d.day}
                type="button"
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${label(d.day)}: ${t("bookingsCount", { count: d.count })}`}
                className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-none"
              >
                <span
                  className={cn(
                    "w-[70%] max-w-6 rounded-t-[4px] transition-[background-color] duration-200",
                    d.count > 0 ? "bg-primary" : "bg-line/80",
                    active !== null && active !== i && "bg-primary/35",
                    "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-primary",
                  )}
                  style={{ height: d.count > 0 ? `${(d.count / top) * 100}%` : "2px" }}
                />
              </button>
            ))}
          </div>
          {/* Tooltip */}
          {active !== null && days[active] && (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-ink px-3 py-2 text-xs whitespace-nowrap text-white shadow-lg"
              style={{ left: `${((active + 0.5) / days.length) * 100}%` }}
            >
              <span className="block font-semibold">{label(days[active].day)}</span>
              <span className="tabular-nums">{t("bookingsCount", { count: days[active].count })}</span>
            </div>
          )}
          {/* X axis: first, middle and last day */}
          <div className="absolute inset-x-0 bottom-0 flex h-6 items-end justify-between text-[11px] text-muted" aria-hidden="true">
            {[0, Math.floor(days.length / 2), days.length - 1].map((i) => (
              <span key={i}>{days[i] ? shortFmt.format(new Date(`${days[i].day}T00:00:00Z`)) : ""}</span>
            ))}
          </div>
        </div>
      </div>
      <table className="sr-only">
        <caption>{t("bookingsChart")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("day")}</th>
            <th scope="col">{t("bookings")}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <td>{label(d.day)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
