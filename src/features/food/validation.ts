import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);

export const restaurantInput = z.object({
  name: text(80).min(2),
  description: text(1000).default(""),
  phone: text(20).nullable().default(null),
  addressLine: text(120).min(2),
  district: text(60).min(2),
  city: text(60).min(2),
  lat: z.number().min(-3).max(0),
  lng: z.number().min(28).max(31.5),
  openingHours: text(120).default(""),
  photoUrl: z.url().max(500).nullable().default(null),
  pickup: z.boolean(),
  delivery: z.boolean(),
  deliveryFee: z.number().int().min(0).max(100_000),
  deliveryKm: z.number().int().min(1).max(50),
  /** Usual minutes until an order is ready; smallest order taken (RWF, before delivery). */
  prepMinutes: z.number().int().min(5).max(240).default(30),
  minOrder: z.number().int().min(0).max(1_000_000).default(0),
  /** The place it belongs to (its guests can order to their room). */
  listingId: z.string().max(64).nullable().default(null),
}).refine((r) => r.pickup || r.delivery, { path: ["pickup"], message: "needsOne" });

export type RestaurantInput = z.input<typeof restaurantInput>;

export const menuItemInput = z.object({
  section: text(40).default(""),
  name: text(80).min(2),
  description: text(300).default(""),
  price: z.number().int().min(1).max(10_000_000),
  photoUrl: z.url().max(500).nullable().default(null),
  available: z.boolean().default(true),
});

export type MenuItemInput = z.input<typeof menuItemInput>;

export const orderInput = z.object({
  restaurantId: z.string().min(1).max(64),
  lines: z.array(z.object({ menuItemId: z.string().min(1).max(64), quantity: z.number().int() })).max(40),
  fulfilment: z.enum(["PICKUP", "DELIVERY", "TO_STAY"]),
  address: text(200).nullable().default(null),
  bookingReference: z.string().max(20).nullable().default(null),
  phone: text(20).min(9),
  note: text(300).nullable().default(null),
});

export type OrderInput = z.input<typeof orderInput>;
