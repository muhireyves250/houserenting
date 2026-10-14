import { z } from "zod";
import { PLACE_TYPES } from "@/features/search/params";

export const FACILITIES = [
  "KITCHEN",
  "WIFI",
  "AIR_CONDITIONER",
  "WORKPLACE",
  "WASHING_MACHINE",
  "DISHWASHER",
  "OVEN",
  "MICROWAVE",
  "PARKING",
  "TV",
  "HOT_WATER",
  "SECURITY",
  "GENERATOR",
  "POOL",
] as const;

export const RATE_UNITS = ["HOUR", "DAY", "NIGHT", "MONTH"] as const;

// Rwanda, with a little margin.
const LAT = { min: -2.95, max: -1.0 };
const LNG = { min: 28.8, max: 30.95 };

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable()
  .optional()
  .transform((v) => v ?? null);
const count = (max: number) => z.number().int().min(0).max(max);

const rate = z
  .object({
    unit: z.enum(RATE_UNITS),
    price: z.number().int().min(100).max(100_000_000),
    minUnits: z.number().int().min(1).max(365).default(1),
    maxUnits: z.number().int().min(1).max(365).nullable().default(null),
    checkInTime: time,
    checkOutTime: time,
    dayStartTime: time,
    dayEndTime: time,
  })
  .refine((r) => r.maxUnits === null || r.maxUnits >= r.minUnits, { path: ["maxUnits"], message: "maxBelowMin" });

const list = (maxItems: number, maxLength: number) =>
  z
    .array(z.string().trim().max(maxLength))
    .max(maxItems)
    .transform((items) => [...new Set(items.filter(Boolean))]);

export const listingInput = z
  .object({
    title: text(5, 100),
    description: text(20, 5000),
    type: z.enum(PLACE_TYPES),
    addressLine: text(2, 120),
    district: text(2, 60),
    city: text(2, 60),
    lat: z.number().min(LAT.min).max(LAT.max),
    lng: z.number().min(LNG.min).max(LNG.max),
    sizeM2: z.number().int().min(1).max(100_000),
    rooms: count(100),
    bedrooms: count(100),
    bathrooms: count(100),
    maxGuests: z.number().int().min(1).max(100),
    petsAllowed: z.boolean(),
    facilities: z.array(z.enum(FACILITIES)).max(FACILITIES.length).transform((f) => [...new Set(f)]),
    characteristics: list(12, 40),
    termsOfRent: list(12, 160),
    depositMonths: z.number().int().min(0).max(12).nullable(),
    discountPercent: z.number().int().min(0).max(90).nullable(),
    rates: z.array(rate).min(1).max(RATE_UNITS.length),
  })
  .refine((l) => new Set(l.rates.map((r) => r.unit)).size === l.rates.length, { path: ["rates"], message: "duplicateUnit" });

export type ListingInput = z.input<typeof listingInput>;
export type ValidListing = z.output<typeof listingInput>;

/** Field path → first problem ("title", "rates.0.price"), for showing next to the form fields. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}
