import { routing, toAppLocale } from "@/i18n/routing";

/** Set by end-to-end tests to start straight on the requested page. */
export const SKIP_WELCOME_COOKIE = "sr_skip_welcome";

// Pages that must open directly: the welcome page itself, and login / account links (often from emails).
const DIRECT_PAGES = new Set(["/welcome", "/login", "/signup", "/forgot-password", "/reset-password", "/check-email", "/verified"]);

/**
 * Where to send a page request before anything is shown, or null to serve it as asked.
 * Opening a link (typed, bookmark, or clicked on another site) or a hard refresh starts on the welcome page,
 * then continues to the link. A normal refresh and loads from inside the site are served directly.
 */
export function welcomeRedirect({ url, headers }: { url: string; headers: Headers }): string | null {
  // Only whole-page loads (not data, prefetch or asset requests).
  if (headers.get("sec-fetch-dest") !== "document" || headers.get("sec-fetch-mode") !== "navigate") return null;
  if ((headers.get("cookie") ?? "").split(/;\s*/).some((c) => c.startsWith(`${SKIP_WELCOME_COOKIE}=`))) return null;

  const site = headers.get("sec-fetch-site");
  const hardReload = /no-cache/i.test(headers.get("cache-control") ?? "") || /no-cache/i.test(headers.get("pragma") ?? "");
  const openedLink = site === "none" || site === "cross-site";
  if (!openedLink && !hardReload) return null;

  const { pathname, search } = new URL(url);
  const [first = "", ...rest] = pathname.split("/").filter(Boolean);
  const hasLocale = (routing.locales as readonly string[]).includes(first);
  const locale = hasLocale ? first : toAppLocale(undefined);
  const path = `/${(hasLocale ? rest : [first, ...rest].filter(Boolean)).join("/")}`;
  if (DIRECT_PAGES.has(path)) return null;

  return `/${locale}/welcome?next=${encodeURIComponent(path + search)}`;
}
