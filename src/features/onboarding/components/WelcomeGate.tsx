"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Set by end-to-end tests to start straight on the requested page. */
export const SKIP_WELCOME_COOKIE = "sr_skip_welcome";

// Pages where the login window is the content: never cover it.
const AUTH_PATHS = new Set(["/login", "/signup", "/forgot-password"]);

// Module state lives for one page load: opening a link, a new tab or a hard refresh resets it; moving
// around inside the app doesn't.
let handledThisLoad = false;

/** Once per full page load: start on the welcome page, then continue to the link that was opened. */
export function WelcomeGate() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (handledThisLoad) return;
    handledThisLoad = true;
    if (document.cookie.split("; ").some((c) => c.startsWith(`${SKIP_WELCOME_COOKIE}=`))) return;
    if (AUTH_PATHS.has(pathname)) return;
    const query = searchParams.toString();
    router.replace({ pathname: "/welcome", query: { next: query ? `${pathname}?${query}` : pathname } });
  }, [pathname, router, searchParams]);

  return null;
}
