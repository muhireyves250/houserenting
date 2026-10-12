export type SearchMode = "short" | "long";

export type SearchQuery = {
  mode: SearchMode;
  location?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
};

const MAX_GUESTS = 30;
const MAX_LOCATION = 100;

type Raw = string | string[] | undefined;
const first = (value: Raw) => (Array.isArray(value) ? value[0] : value);

function isoDate(value: Raw): string | undefined {
  const v = first(value);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const date = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v ? v : undefined;
}

function guestCount(value: Raw): number | undefined {
  const v = first(value);
  if (!v || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n >= 1 && n <= MAX_GUESTS ? n : undefined;
}

export function parseSearchParams(params: Record<string, Raw>): SearchQuery {
  const mode: SearchMode = first(params.mode) === "long" ? "long" : "short";
  const query: SearchQuery = { mode };
  const location = first(params.location)?.trim().slice(0, MAX_LOCATION);
  if (location) query.location = location;
  if (mode === "long") return query;

  const checkIn = isoDate(params.checkIn);
  const checkOut = isoDate(params.checkOut);
  if (checkIn) query.checkIn = checkIn;
  if (checkOut && (!checkIn || checkOut > checkIn)) query.checkOut = checkOut;
  const guests = guestCount(params.guests);
  if (guests) query.guests = guests;
  return query;
}

export function buildSearchQuery(mode: SearchMode, values: Record<string, FormDataEntryValue | undefined>): Record<string, string> {
  const query: Record<string, string> = { mode };
  const keys = mode === "short" ? ["location", "checkIn", "checkOut", "guests"] : ["location"];
  for (const key of keys) {
    const value = values[key];
    if (typeof value === "string" && value.trim()) query[key] = value.trim();
  }
  return query;
}
