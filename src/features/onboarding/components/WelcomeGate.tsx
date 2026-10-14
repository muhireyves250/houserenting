"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { claimWelcome } from "../welcome-state";

/** Set by end-to-end tests to start straight on the requested page. */
export const SKIP_WELCOME_COOKIE = "sr_skip_welcome";

// Pages where the login window is the content: never cover it.
const AUTH_PATHS = new Set(["/login", "/signup", "/forgot-password"]);


/**
 * Once per full page load, opening a link / new tab or a hard refresh starts on the welcome page, then
 * continues to the link. A normal refresh stays on the page. `hardReload` comes from the server: hard refreshes
 * ask for fresh content (Cache-Control: no-cache), which the browser doesn't reveal to the page itself.
 */
export function WelcomeGate({ hardReload = false }: { hardReload?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!claimWelcome()) return;
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type === "reload" && !hardReload) return;
    if (document.cookie.split("; ").some((c) => c.startsWith(`${SKIP_WELCOME_COOKIE}=`))) return;
    if (AUTH_PATHS.has(pathname)) return;
    const query = searchParams.toString();
    router.replace({ pathname: "/welcome", query: { next: query ? `${pathname}?${query}` : pathname } });
  }, [pathname, router, searchParams, hardReload]);

  return null;
}
