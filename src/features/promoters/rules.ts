/** A promoter's reward for a finished stay: the fixed amount when set, otherwise a share of the stay price. */
export function promoterRewardFor(config: { promoterRewardFixed: number | null; promoterRewardBps: number | null }, subtotal: number): number {
  if (config.promoterRewardFixed && config.promoterRewardFixed > 0) return config.promoterRewardFixed;
  if (config.promoterRewardBps && config.promoterRewardBps > 0) return Math.floor((subtotal * config.promoterRewardBps) / 10_000);
  return 0;
}

/** Same guest, same promoter: one reward per 30 days (a guest can't be "brought" again and again). */
export const REPEAT_GUEST_DAYS = 30;
