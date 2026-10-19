import { daysBetween } from "./rules";

export type StayMoment =
  | { kind: "unpaid" }
  | { kind: "upcoming"; days: number }
  | { kind: "arrival" }
  | { kind: "during"; day: number; total: number }
  | { kind: "departure" };

/**
 * Where the guest is in their stay today (Kigali dates): not paid yet, days until arrival, arrival day,
 * day N of the stay, or departure day.
 */
export function stayMoment(stay: { status: string; checkIn: string; checkOut: string }, today: string): StayMoment {
  if (stay.status === "PENDING_PAYMENT") return { kind: "unpaid" };
  if (today < stay.checkIn) return { kind: "upcoming", days: daysBetween(today, stay.checkIn) };
  if (today >= stay.checkOut) return { kind: "departure" };
  if (today === stay.checkIn && stay.status !== "CHECKED_IN") return { kind: "arrival" };
  return { kind: "during", day: daysBetween(stay.checkIn, today) + 1, total: Math.max(1, daysBetween(stay.checkIn, stay.checkOut)) };
}
