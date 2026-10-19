/** Kept free of server-only imports. The promoter whose QR link a visitor opened, for 30 days. */
export const PROMOTER_COOKIE = "sr_promo";
export const PROMOTER_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
const CODE = /^P-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

export const isPromoterCode = (value: string) => CODE.test(value);

/** Only paths on this site (no other sites, no protocol-relative links). */
export function safeTarget(to: string | null): string {
  return to && to.startsWith("/") && !to.startsWith("//") && !to.includes("\\") && to.length <= 300 ? to : "/";
}
