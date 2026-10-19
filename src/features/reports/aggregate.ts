export type Granularity = "day" | "week" | "month" | "year";

export type ReportBooking = {
  reference: string;
  checkIn: string;
  nights: number;
  total: number;
  guestFee: number;
  commission: number;
  hostPayout: number;
  discount: number;
  deposit: number;
  refunded: number;
  placeId: string;
  place: string;
  type: string;
  ownerId: string;
  owner: string;
};

export type Money = { bookings: number; nights: number; gross: number; guestFees: number; commission: number; hostPayout: number; platform: number; refunds: number };

const empty = (): Money => ({ bookings: 0, nights: 0, gross: 0, guestFees: 0, commission: 0, hostPayout: 0, platform: 0, refunds: 0 });

function add(m: Money, b: ReportBooking) {
  m.bookings += 1;
  m.nights += b.nights;
  // Deposits are held, not earned: they stay out of revenue.
  m.gross += b.total - b.deposit;
  m.guestFees += b.guestFee;
  m.commission += b.commission;
  m.hostPayout += b.hostPayout;
  // What the platform keeps: everything the guest paid that isn't the owner's.
  m.platform += b.total - b.deposit - b.hostPayout;
  m.refunds += b.refunded;
}

/** The period a day falls in: the day itself, its week (starting Monday), month or year. */
export function periodKey(day: string, by: Granularity): string {
  if (by === "day") return day;
  if (by === "month") return day.slice(0, 7);
  if (by === "year") return day.slice(0, 4);
  const d = new Date(`${day}T00:00:00Z`);
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000);
  return monday.toISOString().slice(0, 10);
}

function group(bookings: ReportBooking[], key: (b: ReportBooking) => string, label: (b: ReportBooking) => string) {
  const map = new Map<string, Money & { key: string; label: string }>();
  for (const b of bookings) {
    const k = key(b);
    const row = map.get(k) ?? { ...empty(), key: k, label: label(b) };
    add(row, b);
    map.set(k, row);
  }
  return [...map.values()];
}

/**
 * Totals and breakdowns for a set of bookings (by stay date): per period, category, place and owner,
 * the busiest and quietest days, bookings per weekday, and tax estimates at the configured rates.
 */
export function aggregate(bookings: ReportBooking[], opts: { by: Granularity; from: string; to: string; vatBps: number | null; citBps: number | null }) {
  const totals = empty();
  for (const b of bookings) add(totals, b);
  const perDay = new Map<string, number>();
  for (let t = Date.parse(`${opts.from}T00:00:00Z`), end = Date.parse(`${opts.to}T00:00:00Z`), n = 0; t <= end && n < 400; t += 86_400_000, n++) perDay.set(new Date(t).toISOString().slice(0, 10), 0);
  for (const b of bookings) if (perDay.has(b.checkIn)) perDay.set(b.checkIn, perDay.get(b.checkIn)! + 1);
  const days = [...perDay.entries()].map(([day, count]) => ({ day, count }));
  const weekdays = Array.from({ length: 7 }, (_, i) => ({ weekday: i, bookings: 0, gross: 0 }));
  for (const b of bookings) {
    const w = weekdays[new Date(`${b.checkIn}T00:00:00Z`).getUTCDay()]!;
    w.bookings += 1;
    w.gross += b.total - b.deposit;
  }
  const net = totals.platform - totals.refunds;
  const rate = (amount: number, bps: number | null) => (bps ? Math.round((amount * bps) / 10_000) : null);
  const byMoney = (a: Money, b: Money) => b.gross - a.gross;
  return {
    totals,
    byPeriod: group(bookings, (b) => periodKey(b.checkIn, opts.by), (b) => periodKey(b.checkIn, opts.by)).sort((a, b) => a.key.localeCompare(b.key)),
    byType: group(bookings, (b) => b.type, (b) => b.type).sort(byMoney),
    byPlace: group(bookings, (b) => b.placeId, (b) => b.place).sort(byMoney),
    byOwner: group(bookings, (b) => b.ownerId, (b) => b.owner).sort(byMoney),
    busiest: [...days].sort((a, b) => b.count - a.count || a.day.localeCompare(b.day)).slice(0, 5).filter((d) => d.count > 0),
    quietest: [...days].sort((a, b) => a.count - b.count || a.day.localeCompare(b.day)).slice(0, 5),
    weekdays,
    tax: { base: net, vat: rate(net, opts.vatBps), cit: rate(net, opts.citBps) },
  };
}

export type Report = ReturnType<typeof aggregate>;
