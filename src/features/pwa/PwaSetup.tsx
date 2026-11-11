"use client";

import { useEffect } from "react";
import { startInstallWatch } from "./install-store";

// Watch for the install prompt as early as possible: browsers fire it once, right after the page loads.
startInstallWatch();

/** Registers the service worker (needed for "Install app"), in production only. */
export function PwaSetup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Not supported or blocked: the site still works, it just can't be installed.
    });
  }, []);
  return null;
}
