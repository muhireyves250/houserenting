"use server";

import { childrenOf, codesOf, LEVELS, searchLocations, type Level } from "./rwanda";

/** The official places one level down (for the location picker). Public data: no sign-in needed. */
export async function locationChildrenAction(level: Level, parentCode: string | null) {
  if (!LEVELS.includes(level) || (parentCode !== null && (typeof parentCode !== "string" || parentCode.length > 20))) return [];
  return childrenOf(level, parentCode);
}

/** Search sectors, cells and villages by name. */
export async function searchLocationsAction(query: string) {
  if (typeof query !== "string" || query.length > 60) return [];
  return searchLocations(query);
}

/** The codes above a village or any place (to open the picker on a search result). */
export async function locationCodesAction(code: string) {
  if (typeof code !== "string" || code.length > 20) return null;
  return codesOf(code);
}
