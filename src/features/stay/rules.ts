import type { ISODate } from "@/features/search/date-range";

export const STAY_REQUEST_KINDS = ["EXTEND", "SHORTEN", "TRANSFER", "CANCEL"] as const;
export type StayRequestKind = (typeof STAY_REQUEST_KINDS)[number];

const DAY_MS = 86_400_000;
export const daysBetween = (from: ISODate, to: ISODate) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

export type StayFacts = { status: string; checkIn: ISODate; checkOut: ISODate };
export type RequestInput = { kind: StayRequestKind; reason: string; newCheckOut?: ISODate | null; transferTo?: string | null };
export type RequestProblem = "status" | "reason" | "date" | "transferTo";

/**
 * What a guest may ask for, and when. Paid stays only (unpaid holds are simply let go):
 * - stay longer: a later check-out, while the stay is upcoming or under way;
 * - leave earlier: a check-out after today and after check-in, before the current one;
 * - move to another place: before or during the stay, saying where;
 * - cancel: before check-in.
 */
export function checkRequest(stay: StayFacts, input: RequestInput, today: ISODate): RequestProblem | null {
  const live = stay.status === "CONFIRMED" || stay.status === "CHECKED_IN";
  if (!live || stay.checkOut < today) return "status";
  const reason = input.reason.trim();
  if (reason.length < 3 || reason.length > 500) return "reason";
  switch (input.kind) {
    case "EXTEND":
      return input.newCheckOut && input.newCheckOut > stay.checkOut && daysBetween(stay.checkOut, input.newCheckOut) <= 366 ? null : "date";
    case "SHORTEN":
      return input.newCheckOut && input.newCheckOut < stay.checkOut && input.newCheckOut > stay.checkIn && input.newCheckOut >= today ? null : "date";
    case "TRANSFER": {
      const to = input.transferTo?.trim() ?? "";
      return to.length >= 2 && to.length <= 120 ? null : "transferTo";
    }
    case "CANCEL":
      return stay.status === "CONFIRMED" && stay.checkIn > today ? null : "status";
  }
}

/** The price change of new dates at the stay's own daily rate (what it cost per day): + to pay, − to refund. */
export function priceChangeFor(stay: { checkIn: ISODate; checkOut: ISODate; subtotal: number }, newCheckOut: ISODate): number {
  const days = Math.max(1, daysBetween(stay.checkIn, stay.checkOut));
  return Math.round((stay.subtotal / days) * daysBetween(stay.checkOut, newCheckOut));
}

/** Auto-hide: enough dislikes in the window, and staff haven't said to keep the place visible. */
export function shouldAutoHide(dislikes: number, threshold: number | null, keepVisible: boolean): boolean {
  return threshold !== null && threshold > 0 && !keepVisible && dislikes >= threshold;
}
