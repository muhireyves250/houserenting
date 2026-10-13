/** Homes opened on this device, newest first (kept in localStorage; no account needed). */
export type RecentListing = {
  id: string;
  title: string;
  type: string;
  city: string;
  photo: string | null;
  ratingAvg: number;
  ratingCount: number;
};

const KEY = "sr_recent";
const MAX = 12;
export const RECENT_EVENT = "sr-recent-change";

export function addRecent(list: RecentListing[], item: RecentListing): RecentListing[] {
  return [item, ...list.filter((r) => r.id !== item.id)].slice(0, MAX);
}

function valid(value: unknown): value is RecentListing {
  const r = value as RecentListing;
  return Boolean(r) && typeof r.id === "string" && typeof r.title === "string" && typeof r.city === "string";
}

export function readRecent(): RecentListing[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(valid).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberView(item: RecentListing): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(addRecent(readRecent(), item)));
    window.dispatchEvent(new Event(RECENT_EVENT));
  } catch {
    // Storage blocked (private mode): just don't remember.
  }
}
