export const LAUNDRY_STATUSES = ["REQUESTED", "PICKED_UP", "WASHED", "RETURNED", "CANCELLED"] as const;
export type LaundryStatus = (typeof LAUNDRY_STATUSES)[number];

/** The steps staff move a laundry order through, in order (any open order can also be cancelled). */
export const NEXT_LAUNDRY_STEP: Partial<Record<LaundryStatus, LaundryStatus>> = { REQUESTED: "PICKED_UP", PICKED_UP: "WASHED", WASHED: "RETURNED" };
export const OPEN_LAUNDRY: readonly LaundryStatus[] = ["REQUESTED", "PICKED_UP", "WASHED"];

/** Most a guest's laundry can weigh in one order (grams). */
export const MAX_LAUNDRY_GRAMS = 50_000;

/** Kilograms typed by staff ("2.5" or "2,5") to grams; null when not a sensible weight. */
export function gramsFromKg(text: string): number | null {
  const kg = Number(text.trim().replace(",", "."));
  if (!Number.isFinite(kg) || kg <= 0) return null;
  const grams = Math.round(kg * 1000);
  return grams > 0 && grams <= MAX_LAUNDRY_GRAMS ? grams : null;
}

/** Price for the weight at the place's rate, rounded to the franc (0 when laundry is free). */
export function laundryPrice(grams: number, pricePerKg: number): number {
  return Math.round((grams * pricePerKg) / 1000);
}

/** The platform's commission (basis points) and the place's share of a paid laundry amount. */
export function laundrySplit(amount: number, commissionBps: number | null): { commission: number; placeShare: number } {
  const commission = Math.round((amount * (commissionBps ?? 0)) / 10_000);
  return { commission, placeShare: amount - commission };
}

/** Whether the guest still owes money for this order. */
export function laundryOwed(order: { amount: number | null; paidAt: Date | null; status: LaundryStatus }): boolean {
  return order.status !== "CANCELLED" && (order.amount ?? 0) > 0 && !order.paidAt;
}
