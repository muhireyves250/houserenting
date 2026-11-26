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

export type PromoState = "active" | "off" | "expired" | "usedUp" | "scheduled";

/** Where a code is now: working, turned off, ended (past its end date), used up, or not started yet. */
export function promoState(p: { active: boolean; startsAt: Date | null; endsAt: Date | null; maxUses: number | null; usedCount: number }, now: Date): PromoState {
  if (!p.active) return "off";
  if (p.endsAt && p.endsAt <= now) return "expired";
  if (p.maxUses !== null && p.usedCount >= p.maxUses) return "usedUp";
  if (p.startsAt && p.startsAt > now) return "scheduled";
  return "active";
}

/** What a promoter made, from their rewards: everything earned (not voided), waiting for approval, approved to pay, paid. */
export function promoterMoney(rewards: { amount: number; status: string; paidAt: Date | null }[]) {
  const sum = (f: (r: (typeof rewards)[number]) => boolean) => rewards.filter(f).reduce((n, r) => n + r.amount, 0);
  return {
    made: sum((r) => r.status !== "VOID"),
    toApprove: sum((r) => r.status === "PENDING"),
    toPay: sum((r) => r.status === "APPROVED" && !r.paidAt),
    paid: sum((r) => r.paidAt !== null),
  };
}
