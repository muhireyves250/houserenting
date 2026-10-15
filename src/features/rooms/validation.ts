import { z } from "zod";
import { FACILITIES } from "@/features/hosting/validation";

export const ROOM_STATUSES = ["AVAILABLE", "MAINTENANCE", "UNAVAILABLE", "CLEANING"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const roomInput = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500),
  maxGuests: z.number().int().min(1).max(50),
  nightlyPrice: z.number().int().min(100).max(100_000_000),
  facilities: z.array(z.enum(FACILITIES)).max(FACILITIES.length).transform((f) => [...new Set(f)]),
});

export type RoomInput = z.input<typeof roomInput>;
