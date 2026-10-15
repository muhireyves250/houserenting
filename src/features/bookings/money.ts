export type FeeConfig = { commissionBps: number | null; guestFeeBps: number | null };

/** A promo discount and who pays for it: the platform (the owner still gets the full price) or the owner. */
export type Discount = { amount: number; fundedBy: "PLATFORM" | "HOST" };

export type PriceBreakdown = {
  /** Nights (or months) × price. */
  subtotal: number;
  /** Promo discount off the subtotal. */
  discount: number;
  /** Platform fee the guest pays on top (on the discounted price). */
  guestFee: number;
  /** What the guest pays for the stay (without any deposit). */
  total: number;
  /** Platform commission. */
  commission: number;
  /** What the property owner is owed. */
  hostPayout: number;
};

/** Basis points of an amount, in whole francs (RWF has no smaller unit). */
const share = (amount: number, bps: number | null) => (bps ? Math.round((amount * bps) / 10_000) : 0);

/**
 * Splits a stay's price using the fee settings in force when it is booked. The guest's payment is never all
 * platform revenue: it is the owner's payout plus the platform's share (commission + guest fee − any discount it funds).
 */
export function priceBreakdown(subtotal: number, fees: FeeConfig, discount: Discount | null = null): PriceBreakdown {
  const off = Math.min(subtotal, Math.max(0, discount?.amount ?? 0));
  const guestPays = subtotal - off;
  const guestFee = share(guestPays, fees.guestFeeBps);
  // The owner is credited on the full price unless the owner funds the discount.
  const ownerBase = discount?.fundedBy === "HOST" ? guestPays : subtotal;
  const commission = share(ownerBase, fees.commissionBps);
  return { subtotal, discount: off, guestFee, total: guestPays + guestFee, commission, hostPayout: ownerBase - commission };
}
