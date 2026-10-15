export type PromoRule = { percentOff: number | null; amountOff: number | null; minSubtotal: number | null };

/** Discount a promo code gives on a stay price (whole francs, never more than the price). */
export function promoDiscount(subtotal: number, rule: PromoRule): number {
  if (rule.minSubtotal && subtotal < rule.minSubtotal) return 0;
  const byPercent = rule.percentOff ? Math.round((subtotal * rule.percentOff) / 100) : 0;
  const byAmount = rule.amountOff ?? 0;
  return Math.min(subtotal, Math.max(byPercent, byAmount));
}

/** Codes are typed by people: case and spaces don't matter. */
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
