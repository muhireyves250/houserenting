"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Set by end-to-end tests to start straight on the requested page. */
export const SKIP_WELCOME_COOKIE = "sr_skip_welcome";

// Pages where the login window is the content: never cover it.
const AUTH_PATHS = new Set(["/login", "/signup", "/forgot-password"]);
const SPLASH_MS = 1700;
const SPLASH_OUT_MS = 500;

// Module state lives for one page load: a full load or hard refresh resets it, client navigation doesn't.
let handledThisLoad = false;

/**
 * Phones, once per full page load: signed-out visitors start on the welcome page (then return to where they
 * were); signed-in users get a short animated welcome splash before the app.
 */
export function WelcomeGate({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [splash, setSplash] = useState<"in" | "out" | null>(null);

  useEffect(() => {
    if (handledThisLoad) return;
    handledThisLoad = true;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    if (document.cookie.split("; ").some((c) => c.startsWith(`${SKIP_WELCOME_COOKIE}=`))) return;
    if (AUTH_PATHS.has(pathname)) return;
    if (!signedIn) {
      router.replace({ pathname: "/welcome", query: { next: pathname } });
      return;
    }
    // A full load just happened (no other way to reach this branch): play the splash once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSplash("in");
  }, [pathname, router, signedIn]);

  // Splash timeline: stay, then fade out, then remove.
  useEffect(() => {
    if (!splash) return;
    const timer = setTimeout(() => setSplash(splash === "in" ? "out" : null), splash === "in" ? SPLASH_MS : SPLASH_OUT_MS);
    return () => clearTimeout(timer);
  }, [splash]);

  if (!splash) return null;
  return (
    <div
      data-testid="welcome-splash"
      data-leaving={splash === "out"}
      aria-hidden="true"
      className="welcome-splash fixed inset-0 z-[90] flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-surface to-primary-soft"
    >
      <svg viewBox="0 0 64 56" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="square" className="welcome-logo h-20 w-[92px] text-primary">
        {["M4 28 32 6l28 22", "M14 23v29h14v-9", "M23 26v12h18", "M41 26v26h9V23"].map((d, i) => (
          <path key={d} d={d} pathLength={1} style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </svg>
      <p className="welcome-name text-2xl font-bold tracking-[-0.02em] text-primary">Space Rental</p>
    </div>
  );
}
