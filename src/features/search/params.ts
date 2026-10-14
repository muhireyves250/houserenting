export type SearchMode = "short" | "long";

export const PLACE_TYPES = ["APARTMENT", "DUPLEX", "PRIVATE_HOUSE", "LODGE", "ROOM"] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

/** Visible map area: [south, west, north, east] in degrees. */
export type Bbox = [number, number, number, number];

export const AMENITIES = [
  "WIFI",
  "KITCHEN",
  "PARKING",
  "HOT_WATER",
  "WASHING_MACHINE",
  "AIR_CONDITIONER",
  "WORKPLACE",
  "TV",
  "SECURITY",
  "GENERATOR",
  "POOL",
  "DISHWASHER",
  "OVEN",
  "MICROWAVE",
] as const;
export type Amenity = (typeof AMENITIES)[number];

/** Results-page filters; they work in both modes (price is per night/day/hour short-term, per month long-term). */
export type SearchFilters = {
  types?: PlaceType[];
  minPrice?: number;
  maxPrice?: number;
  /** At least this many bedrooms. */
  bedrooms?: number;
  /** Must have all of these. */
  amenities?: Amenity[];
};

export type SearchQuery = SearchFilters & {
  mode: SearchMode;
  /** Set when the map is used as the filter ("search as I move the map"). */
  bbox?: Bbox;
  location?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  pets?: number;
  /** ± days of date flexibility (1–3). */
  flex?: number;
};

const MAX_GUESTS = 30;
const MAX_LOCATION = 100;
const MAX_PETS = 5;
const MAX_FLEX_DAYS = 3;
const MAX_PRICE = 100_000_000;
const MAX_BEDROOMS = 10;

type Raw = string | string[] | undefined;
const first = (value: Raw) => (Array.isArray(value) ? value[0] : value);

function isoDate(value: Raw): string | undefined {
  const v = first(value);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const date = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v ? v : undefined;
}

function intBetween(value: Raw, min: number, max: number): number | undefined {
  const v = first(value);
  if (!v || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
}

function parseFilters(params: Record<string, Raw>): SearchFilters {
  const filters: SearchFilters = {};
  const types = [...new Set((first(params.type) ?? "").split(","))].filter((t): t is PlaceType =>
    (PLACE_TYPES as readonly string[]).includes(t),
  );
  if (types.length > 0) filters.types = types;
  const minPrice = intBetween(params.minPrice, 1, MAX_PRICE);
  const maxPrice = intBetween(params.maxPrice, 1, MAX_PRICE);
  if (minPrice) filters.minPrice = minPrice;
  if (maxPrice && (!minPrice || maxPrice >= minPrice)) filters.maxPrice = maxPrice;
  const bedrooms = intBetween(params.beds, 1, MAX_BEDROOMS);
  if (bedrooms) filters.bedrooms = bedrooms;
  const amenities = AMENITIES.filter((a) => (first(params.amenities) ?? "").split(",").includes(a));
  if (amenities.length > 0) filters.amenities = amenities;
  return filters;
}

function parseBbox(value: Raw): Bbox | undefined {
  const parts = (first(value) ?? "").split(",");
  if (parts.length !== 4 || parts.some((p) => !/^-?\d+(\.\d+)?$/.test(p.trim()))) return undefined;
  const [south, west, north, east] = parts.map(Number) as Bbox;
  const valid = south >= -90 && north <= 90 && west >= -180 && east <= 180 && south < north && west < east;
  return valid ? [south, west, north, east] : undefined;
}

/** A map area for the URL, rounded to 4 decimals (~11 m). */
export function formatBbox(bbox: Bbox): string {
  return bbox.map((n) => Number(n.toFixed(4))).join(",");
}

/** URL params for the results-page filters (empty ones left out). */
export function filterParams(filters: SearchFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.types?.length) params.type = filters.types.join(",");
  if (filters.minPrice) params.minPrice = String(filters.minPrice);
  if (filters.maxPrice) params.maxPrice = String(filters.maxPrice);
  if (filters.bedrooms) params.beds = String(filters.bedrooms);
  if (filters.amenities?.length) params.amenities = filters.amenities.join(",");
  return params;
}

export function parseSearchParams(params: Record<string, Raw>): SearchQuery {
  const mode: SearchMode = first(params.mode) === "long" ? "long" : "short";
  const query: SearchQuery = { mode };
  const location = first(params.location)?.trim().slice(0, MAX_LOCATION);
  if (location) query.location = location;
  Object.assign(query, parseFilters(params));
  const bbox = parseBbox(params.bbox);
  if (bbox) query.bbox = bbox;
  if (mode === "long") return query;

  const checkIn = isoDate(params.checkIn);
  const checkOut = isoDate(params.checkOut);
  if (checkIn) query.checkIn = checkIn;
  if (checkOut && (!checkIn || checkOut > checkIn)) query.checkOut = checkOut;
  const guests = intBetween(params.guests, 1, MAX_GUESTS);
  if (guests) query.guests = guests;
  const pets = intBetween(params.pets, 1, MAX_PETS);
  if (pets) query.pets = pets;
  const flex = intBetween(params.flex, 1, MAX_FLEX_DAYS);
  if (flex) query.flex = flex;
  return query;
}

export function buildSearchQuery(
  mode: SearchMode,
  values: Record<string, FormDataEntryValue | number | undefined>,
): Record<string, string> {
  const query: Record<string, string> = { mode };
  const keys = mode === "short" ? ["location", "checkIn", "checkOut", "guests", "pets", "flex"] : ["location"];
  for (const key of keys) {
    const value = values[key];
    if (typeof value === "number" && value > 0) query[key] = String(value);
    else if (typeof value === "string" && value.trim()) query[key] = value.trim();
  }
  return query;
}
