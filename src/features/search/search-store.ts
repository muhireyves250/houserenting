"use client";

import { useSyncExternalStore } from "react";
import type { DateRange } from "./date-range";
import type { GuestCounts } from "./guests";
import type { SearchMode } from "./params";

/** What the user has entered so far; shared by the hero search and the header search. */
export type SearchState = {
  mode: SearchMode;
  location: string;
  range: DateRange;
  flex: number;
  guests: GuestCounts;
};

const INITIAL: SearchState = { mode: "short", location: "", range: {}, flex: 0, guests: { adults: 0, children: 0, pets: 0 } };

let state = INITIAL;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(patch: Partial<SearchState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function useSearchState(): [SearchState, (patch: Partial<SearchState>) => void] {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => INITIAL);
  return [snapshot, update];
}

/** Test helper: back to the empty state. */
export function resetSearchState() {
  update(INITIAL);
}
