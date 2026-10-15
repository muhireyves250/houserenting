/** Kept free of server-only imports: the proxy uses it on every request. */
export const REFERRAL_COOKIE = "sr_ref";
export const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
const CODE = /^R-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

/** The invite code in a link (?ref=R-XXXXXX), if it looks valid. */
export function referralFromUrl(url: string): string | null {
  const ref = new URL(url).searchParams.get("ref")?.trim().toUpperCase() ?? "";
  return CODE.test(ref) ? ref : null;
}
