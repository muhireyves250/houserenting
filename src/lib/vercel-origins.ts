/**
 * Addresses Vercel serves this deployment at (production domain, branch and per-deployment URLs), so logging in
 * works whichever of them is opened. Vercel sets these; they are absent locally.
 */
export function vercelOrigins(source: Record<string, string | undefined> = process.env): string[] {
  return [source.VERCEL_PROJECT_PRODUCTION_URL, source.VERCEL_BRANCH_URL, source.VERCEL_URL]
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`);
}
