import type { ISODate } from "@/features/search/date-range";

/** Moves out the same day of the month, `months` later (Jan 31 + 1 month → Feb 28/29). */
export function addMonthsISO(start: ISODate, months: number): ISODate {
  const [y, m, d] = start.split("-").map(Number) as [number, number, number];
  const index = (m - 1) + months;
  const year = y + Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type MonthlyQuote = { months: number; monthly: number; rent: number; deposit: number; moveOut: ISODate };

/** Rent for whole months; a deposit only when one is configured (percent of one month). */
export function monthlyQuote(start: ISODate, months: number, monthlyPrice: number, depositPercent: number | null): MonthlyQuote {
  return {
    months,
    monthly: monthlyPrice,
    rent: monthlyPrice * months,
    deposit: depositPercent ? Math.round((monthlyPrice * depositPercent) / 100) : 0,
    moveOut: addMonthsISO(start, months),
  };
}
