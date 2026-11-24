import { z } from "zod";
import { FACILITIES, RATE_UNITS } from "@/features/hosting/validation";

export const ROOM_STATUSES = ["AVAILABLE", "MAINTENANCE", "UNAVAILABLE", "CLEANING"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

const photoUrl = z.string().max(500).regex(/^https:\/\/(res\.cloudinary\.com|images\.unsplash\.com)\//);

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().default(null).or(z.literal("").transform(() => null));

const roomFields = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500),
  maxGuests: z.number().int().min(1).max(50),
  /** The ways of booking this category (at least one), each with its own rules; prices are on its rooms. */
  rates: z
    .array(
      z.object({
        unit: z.enum(RATE_UNITS),
        // Prices are set on each room; the category keeps its cheapest room's (its "from" price), worked out on save.
        price: z.number().int().min(0).max(100_000_000).default(0),
        // This category's own rules for the unit: shortest and longest stay, and times (empty = none).
        minUnits: z.number().int().min(1).max(1000).default(1),
        maxUnits: z.number().int().min(1).max(1000).nullable().default(null),
        checkInTime: time,
        checkOutTime: time,
        dayStartTime: time,
        dayEndTime: time,
      }),
    )
    .min(1)
    .max(RATE_UNITS.length)
    .refine((rates) => new Set(rates.map((r) => r.unit)).size === rates.length, { message: "duplicateUnit" }),
  /** This category's own discount (%) and laundry price per kg (0 = free laundry); empty = the place's. */
  discountPercent: z.number().int().min(0).max(90).nullable().default(null),
  laundryPricePerKg: z.number().int().min(0).max(100_000).nullable().default(null),
  facilities: z.array(z.enum(FACILITIES)).max(FACILITIES.length).transform((f) => [...new Set(f)]),
  /** Identical rooms of this type ("101", "102"…); each guest is given a free one. Empty = a single room. */
  /** Photos of this room type: our uploads (Cloudinary) or the demo photos. */
  photos: z.array(photoUrl).max(12).default([]),
  /** Each room's own photos and description, by its name or number. */
  unitDetails: z
    .record(
      z.string().trim().min(1).max(40),
      z.object({
        photos: z.array(photoUrl).max(12).default([]),
        description: z.string().trim().max(500).default(""),
        // The room's own price for each way of booking (the category has no price of its own).
        prices: z.partialRecord(z.enum(RATE_UNITS), z.number().int().min(100).max(100_000_000)).default({}),
      }),
    )
    .default({}),
  numbers: z
    .array(z.string().trim().min(1).max(40))
    .max(200)
    .default([])
    .transform((n) => [...new Set(n)]),
});

/** "101, 102 103" → ["101", "102", "103"] (commas, spaces or new lines). */
export type UnitDetails = Record<string, { photos: string[]; description: string; prices: Partial<Record<(typeof RATE_UNITS)[number], number>> }>;

/** A room type: its fields, keeping details only for rooms that are in it (and that have any). */
export const roomInput = roomFields.transform((room) => ({
  ...room,
  unitDetails: Object.fromEntries(Object.entries(room.unitDetails).filter(([n, d]) => room.numbers.includes(n) && (d.photos.length > 0 || d.description.length > 0 || Object.keys(d.prices).length > 0))),
}));

/** Rooms' own details as stored (JSON), read safely. */
export function unitDetailsMap(value: unknown): UnitDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: UnitDetails = {};
  for (const [n, d] of Object.entries(value as Record<string, unknown>)) {
    if (!d || typeof d !== "object") continue;
    const { photos, description, prices } = d as { photos?: unknown; description?: unknown; prices?: unknown };
    const own: UnitDetails[string]["prices"] = {};
    if (prices && typeof prices === "object") for (const u of RATE_UNITS) { const p = (prices as Record<string, unknown>)[u]; if (typeof p === "number" && Number.isInteger(p) && p > 0) own[u] = p; }
    out[n] = { photos: Array.isArray(photos) ? photos.filter((u): u is string => typeof u === "string") : [], description: typeof description === "string" ? description : "", prices: own };
  }
  return out;
}

type RoomWithDetails = { photos: string[]; description: string; unitDetails: unknown };

/** The photos to show for one room: its own, else its type's, else the place's. */
export function photosOfRoom(room: RoomWithDetails, number: string | null, placePhotos: string[]): string[] {
  const own = number ? (unitDetailsMap(room.unitDetails)[number]?.photos ?? []) : [];
  return own.length > 0 ? own : room.photos.length > 0 ? room.photos : placePhotos;
}

/** One room's description: its own, else its type's. */
export function descriptionOfRoom(room: RoomWithDetails, number: string | null): string {
  return (number ? unitDetailsMap(room.unitDetails)[number]?.description : "") || room.description;
}

export function parseRoomNumbers(text: string): string[] {
  return [...new Set(text.split(/[,;\n]+/).map((n) => n.trim()).filter(Boolean))].slice(0, 200);
}

export type RoomInput = z.input<typeof roomInput>;

/** One room of a room type: its name or number, and its own photos and description (empty = the type's). */
export const roomUnitInput = z.object({
  name: z.string().trim().min(1).max(40),
  photos: z.array(photoUrl).max(12).default([]),
  description: z.string().trim().max(500).default(""),
  /** The room's price for each way its category is booked. */
  prices: z.partialRecord(z.enum(RATE_UNITS), z.number().int().min(100).max(100_000_000)).default({}),
});
export type RoomUnitInput = z.input<typeof roomUnitInput>;

/**
 * One room's price for a way of booking: its own (numbered rooms each have one), else the category's (a category
 * that is a single room). Null when it isn't offered.
 */
export function priceOfRoom(room: { unitDetails: unknown; rates: { unit: string; price: number }[] }, number: string | null, unit: string): number | null {
  const own = number ? unitDetailsMap(room.unitDetails)[number]?.prices[unit as (typeof RATE_UNITS)[number]] : undefined;
  return own ?? room.rates.find((r) => r.unit === unit)?.price ?? null;
}
