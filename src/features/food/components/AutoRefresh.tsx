"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";

/** Reloads the page's data every few seconds while something is in progress (an open order), and when the tab comes back. */
export function AutoRefresh({ seconds = 15, active = true }: { seconds?: number; active?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, seconds, router]);
  return null;
}
