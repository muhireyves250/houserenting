export type FeeConfig = { commissionBps: number | null; guestFeeBps: number | null };

export type PriceBreakdown = {
  /** Nights × nightly price. */
  subtotal: number;
  /** Platform fee the guest pays on top. */
  guestFee: number;
  /** What the guest pays. */
  total: number;
  /** Platform commission, taken from the stay price. */
  commission: number;
  /** What the property owner is owed. */
  hostPayout: number;
};

/** Basis points of an amount, in whole francs (RWF has no smaller unit). */
const share = (amount: number, bps: number | null) => (bps ? Math.round((amount * bps) / 10_000) : 0);

/**
 * Splits a stay's price using the fee settings in force when it is booked. The guest's payment is never all
 * platform revenue: it is the owner's payout, plus the commission, plus any guest fee.
 */
export function priceBreakdown(subtotal: number, fees: FeeConfig): PriceBreakdown {
  const guestFee = share(subtotal, fees.guestFeeBps);
  const commission = share(subtotal, fees.commissionBps);
  return { subtotal, guestFee, total: subtotal + guestFee, commission, hostPayout: subtotal - commission };
}
