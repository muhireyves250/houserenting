"use client";

import { useSyncExternalStore } from "react";

/** True while a filter change is loading new results; listings show a skeleton meanwhile. */
let pending = false;
const listeners = new Set<() => void>();

export function setResultsPending(value: boolean): void {
  if (value === pending) return;
  pending = value;
  for (const listener of listeners) listener();
}

export function useResultsPending(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => pending,
    () => false,
  );
}
