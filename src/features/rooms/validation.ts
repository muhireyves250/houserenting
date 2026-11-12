import { z } from "zod";
import { FACILITIES, RATE_UNITS } from "@/features/hosting/validation";

export const ROOM_STATUSES = ["AVAILABLE", "MAINTENANCE", "UNAVAILABLE", "CLEANING"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

const photoUrl = z.string().max(500).regex(/^https:\/\/(res\.cloudinary\.com|images\.unsplash\.com)\//);

const roomFields = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500),
  maxGuests: z.number().int().min(1).max(50),
  /** The room's own price for each way of booking it (at least one). */
  rates: z
    .array(z.object({ unit: z.enum(RATE_UNITS), price: z.number().int().min(100).max(100_000_000) }))
    .min(1)
    .max(RATE_UNITS.length)
    .refine((rates) => new Set(rates.map((r) => r.unit)).size === rates.length, { message: "duplicateUnit" }),
  facilities: z.array(z.enum(FACILITIES)).max(FACILITIES.length).transform((f) => [...new Set(f)]),
  /** Identical rooms of this type ("101", "102"…); each guest is given a free one. Empty = a single room. */
  /** Photos of this room type: our uploads (Cloudinary) or the demo photos. */
  photos: z.array(photoUrl).max(12).default([]),
  /** Each room's own photos and description, by its name or number. */
  unitDetails: z
    .record(z.string().trim().min(1).max(40), z.object({ photos: z.array(photoUrl).max(12).default([]), description: z.string().trim().max(500).default("") }))
    .default({}),
  numbers: z
    .array(z.string().trim().min(1).max(40))
    .max(200)
    .default([])
    .transform((n) => [...new Set(n)]),
});

/** "101, 102 103" → ["101", "102", "103"] (commas, spaces or new lines). */
export type UnitDetails = Record<string, { photos: string[]; description: string }>;

/** A room type: its fields, keeping details only for rooms that are in it (and that have any). */
export const roomInput = roomFields.transform((room) => ({
  ...room,
  unitDetails: Object.fromEntries(Object.entries(room.unitDetails).filter(([n, d]) => room.numbers.includes(n) && (d.photos.length > 0 || d.description.length > 0))),
}));

/** Rooms' own details as stored (JSON), read safely. */
export function unitDetailsMap(value: unknown): UnitDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: UnitDetails = {};
  for (const [n, d] of Object.entries(value as Record<string, unknown>)) {
    if (!d || typeof d !== "object") continue;
    const { photos, description } = d as { photos?: unknown; description?: unknown };
    out[n] = { photos: Array.isArray(photos) ? photos.filter((u): u is string => typeof u === "string") : [], description: typeof description === "string" ? description : "" };
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
