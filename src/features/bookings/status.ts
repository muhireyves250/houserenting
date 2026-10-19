import type { ISODate } from "@/features/search/date-range";

export type BookingStatus = "PENDING_PAYMENT" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "EXPIRED" | "NO_SHOW";

/** The booking state machine: every status change must be listed here. */
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  // Payment verified, hold ran out, or the guest let it go.
  PENDING_PAYMENT: ["CONFIRMED", "EXPIRED", "CANCELLED"],
  // Paid: arrives, is cancelled (unpaid by the guest, paid ones through an approved request), or never shows up.
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
  NO_SHOW: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Statuses that hold the dates (the database refuses overlaps among these). */
export const BLOCKING_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] as const satisfies readonly BookingStatus[];

export function isHoldActive(booking: { status: BookingStatus; holdExpiresAt: Date | null }, now: Date): boolean {
  return booking.status === "PENDING_PAYMENT" && booking.holdExpiresAt !== null && booking.holdExpiresAt > now;
}

export type StayPhase = "current" | "upcoming" | "past";

/** Where a booking belongs for the guest: My stay (current), upcoming, or past. */
export function stayPhase(
  booking: { status: BookingStatus; checkIn: ISODate; checkOut: ISODate; holdExpiresAt: Date | null },
  today: ISODate,
  now: Date,
): StayPhase {
  const { status, checkIn, checkOut } = booking;
  if (status === "CHECKED_IN") return "current";
  if (status === "CONFIRMED") {
    if (checkOut < today) return "past";
    return checkIn <= today ? "current" : "upcoming";
  }
  if (status === "PENDING_PAYMENT" && isHoldActive(booking, now)) return "upcoming";
  return "past";
}
