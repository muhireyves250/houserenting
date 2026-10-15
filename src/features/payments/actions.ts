"use server";

import { isBookingReference } from "@/features/bookings/reference";
import { parseMobileMoney } from "@/features/listings/mobile-money";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getCurrentUser } from "@/lib/session";
import { getPaymentProvider } from "./providers";

export type PayResult = { ok: true } | { ok: false; error: "auth" | "notConnected" | "notPayable" | "phone" | "providerDown" };

/** Asks the guest's phone to approve paying for their own booking (while its dates are still held). */
export async function requestPaymentAction(reference: string, method: "mtn" | "airtel", phone: string): Promise<PayResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "auth" };
  const provider = getPaymentProvider();
  if (!provider) return { ok: false, error: "notConnected" };
  if (typeof reference !== "string" || !isBookingReference(reference) || (method !== "mtn" && method !== "airtel") || typeof phone !== "string") {
    return { ok: false, error: "notPayable" };
  }
  const number = parseMobileMoney(method, phone);
  if (!number.ok) return { ok: false, error: "phone" };
  const booking = await db.booking.findFirst({
    where: { reference, guestId: user.id, status: "PENDING_PAYMENT", holdExpiresAt: { gt: new Date() } },
    select: { total: true, currency: true },
  });
  if (!booking) return { ok: false, error: "notPayable" };
  try {
    return await provider.requestPayment({ bookingReference: reference, amount: booking.total, currency: booking.currency, method, phone: number.number });
  } catch (err) {
    logger.error({ err, reference }, "payment request failed");
    return { ok: false, error: "providerDown" };
  }
}
