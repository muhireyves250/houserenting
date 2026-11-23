export type FeeModel = "ADD_ON" | "INCLUDED";
export type FeeConfig = {
  commissionBps: number | null;
  guestFeeBps: number | null;
  model?: FeeModel;
  /** An agreed fixed fee per booking (RWF) instead of a percentage. */
  fixedCommission?: number | null;
};

/**
 * The fees for one booking: the commission for the place's category (or the default), and the guest fee only when
 * fees are added on top. With fees included, guests pay the listed price and the platform's share comes out of it.
 */
/**
 * The fees for a place: its own commission when VIIPA set one for it, else its category's rate, else the platform's.
 */
export function feesFor(
  settings: {
    commissionBps: number | null;
    guestFeeBps: number | null;
    feeModel?: FeeModel;
    commissionByType?: Record<string, number> | null;
  },
  placeType: string,
  placeCommissionBps?: number | null,
): FeeConfig {
  const model = settings.feeModel ?? "ADD_ON";
  const byType = settings.commissionByType?.[placeType];
  return {
    commissionBps:
      typeof placeCommissionBps === "number" && placeCommissionBps >= 0
        ? placeCommissionBps
        : typeof byType === "number" && byType >= 0
          ? byType
          : settings.commissionBps,
    guestFeeBps: model === "INCLUDED" ? null : settings.guestFeeBps,
    model,
  };
}

/** A promo discount (always taken from the owner's payout; `fundedBy` is kept on older codes only). */
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
const share = (amount: number, bps: number | null) =>
  bps ? Math.round((amount * bps) / 10_000) : 0;

/**
 * Splits a stay's price using the fee settings in force when it is booked. The guest's payment is never all
 * platform revenue: it is the owner's payout plus the platform's share (commission + guest fee − any discount it funds).
 */
export function priceBreakdown(
  subtotal: number,
  fees: FeeConfig,
  discount: Discount | null = null,
): PriceBreakdown {
  const off = Math.min(subtotal, Math.max(0, discount?.amount ?? 0));
  const guestPays = subtotal - off;
  const guestFee = share(guestPays, fees.guestFeeBps);
  // VIIPA's commission is on the full price; the owner gets the price less the commission and less any promo discount.
  const commission = typeof fees.fixedCommission === "number" ? Math.min(fees.fixedCommission, subtotal) : share(subtotal, fees.commissionBps);
  const hostPayout = subtotal - commission - off;
  return {
    subtotal,
    discount: off,
    guestFee,
    total: guestPays + guestFee,
    commission,
    hostPayout,
  };
}
