"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LogoReveal } from "./LogoReveal";

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
  return <LogoReveal testId="welcome-splash" leaving={splash === "out"} />;
}
