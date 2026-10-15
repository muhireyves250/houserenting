"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/session";
import { isBookingReference } from "./reference";
import { checkPromo } from "@/features/promotions/service";
import { db } from "@/lib/db";
import { cancelPendingBooking, createBooking, createMonthlyBooking, type BookingError } from "./service";

const input = z.object({
  listingId: z.string().min(1).max(64),
  checkIn: z.string().max(10),
  checkOut: z.string().max(10),
  guests: z.number().int().min(1).max(50),
  roomId: z.string().min(1).max(64).nullable().optional(),
  promoCode: z.string().max(40).nullable().optional(),
  payment: z.object({ method: z.enum(["mtn", "airtel"]), phone: z.string().max(20) }),
});

export type BookStayResult = { reference: string } | { error: BookingError | "auth" | "failed" };

export async function bookStayAction(raw: unknown): Promise<BookStayResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "auth" };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: "invalid" };
  try {
    const result = await createBooking({ guestId: user.id, ...parsed.data });
    if (!result.ok) return { error: result.error };
    revalidatePath("/[locale]/bookings", "page");
    revalidatePath(`/[locale]/listings/${parsed.data.listingId}`, "page");
    return { reference: result.reference };
  } catch (err) {
    logger.error({ err, listingId: parsed.data.listingId }, "booking failed");
    return { error: "failed" };
  }
}

export async function cancelBookingAction(reference: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || typeof reference !== "string" || !isBookingReference(reference)) return { ok: false };
  try {
    const ok = await cancelPendingBooking(user.id, reference);
    if (ok) revalidatePath("/[locale]/bookings", "layout");
    return { ok };
  } catch (err) {
    logger.error({ err, reference }, "cancel booking failed");
    return { ok: false };
  }
}

const monthlyInput = z.object({
  listingId: z.string().min(1).max(64),
  start: z.string().max(10),
  months: z.number().int().min(1).max(60),
  promoCode: z.string().max(40).nullable().optional(),
  payment: z.object({ method: z.enum(["mtn", "airtel"]), phone: z.string().max(20) }),
  identity: z.object({ idNumber: z.string().trim().max(40), nationality: z.string().trim().max(60).nullable() }).nullable().optional(),
});

export async function bookMonthlyAction(raw: unknown): Promise<BookStayResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "auth" };
  const parsed = monthlyInput.safeParse(raw);
  if (!parsed.success) return { error: "invalid" };
  try {
    const result = await createMonthlyBooking({ guestId: user.id, ...parsed.data });
    if (!result.ok) return { error: result.error };
    revalidatePath("/[locale]/bookings", "page");
    return { reference: result.reference };
  } catch (err) {
    logger.error({ err, listingId: parsed.data.listingId }, "monthly booking failed");
    return { error: "failed" };
  }
}

/** Preview of a promo code's discount on a price (the booking checks it again). */
export async function checkPromoAction(code: string, subtotal: number): Promise<{ discount: number } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "auth" };
  if (typeof code !== "string" || code.length > 40 || !Number.isInteger(subtotal) || subtotal < 0 || subtotal > 1_000_000_000) return { error: "unknown" };
  const result = await checkPromo(db, code, subtotal);
  return result.ok ? { discount: result.discount } : { error: result.error };
}
