"use client";

import { useSyncExternalStore } from "react";

/** Subscribes to a CSS media query. `serverValue` is used during SSR and hydration. */
export function useMediaQuery(query: string, serverValue = true): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    // Environments without matchMedia fall back to the server value.
    () => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : serverValue),
    () => serverValue,
  );
}
