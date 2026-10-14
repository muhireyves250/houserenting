/** Calendar dates as "YYYY-MM-DD" strings: timezone-free and comparable with < and >. */
export type ISODate = string;
export type DateRange = { checkIn?: ISODate; checkOut?: ISODate };

const pad = (n: number) => String(n).padStart(2, "0");

export function isoOf(year: number, month: number, day: number): ISODate {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** Weeks (Sunday first) for a month; days outside the month are null. `month` is 0-based. */
export function monthGrid(year: number, month: number): (ISODate | null)[][] {
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (ISODate | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(isoOf(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (ISODate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

/** Click handling for a check-in → check-out range picker. */
export function pickDate(range: DateRange, day: ISODate): DateRange {
  if (range.checkIn && !range.checkOut && day > range.checkIn) return { checkIn: range.checkIn, checkOut: day };
  return { checkIn: day };
}

export function inRange(range: DateRange, day: ISODate): boolean {
  return Boolean(range.checkIn && range.checkOut && day > range.checkIn && day < range.checkOut);
}

export function todayISO(now: Date = new Date(), timeZone = "Africa/Kigali"): ISODate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type BookedRange = { checkIn: ISODate; checkOut: ISODate };

/** Whether the stay shares a night with any booking (a checkout day can be the next check-in). */
export function rangeOverlaps(range: DateRange, booked: BookedRange[]): boolean {
  if (!range.checkIn || !range.checkOut) return false;
  return booked.some((b) => range.checkIn! < b.checkOut && b.checkIn < range.checkOut!);
}

/**
 * Days the calendar can't offer: booked nights when choosing check-in, and, once check-in is set,
 * checkout days that would run over the next booking.
 */
export function isDayBlocked(range: DateRange, day: ISODate, booked: BookedRange[]): boolean {
  if (range.checkIn && !range.checkOut && day > range.checkIn) {
    return rangeOverlaps({ checkIn: range.checkIn, checkOut: day }, booked);
  }
  return booked.some((b) => b.checkIn <= day && day < b.checkOut);
}
