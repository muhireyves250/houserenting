import "server-only";
import { db } from "@/lib/db";

/**
 * Whether this account is a customer now. Everyone signs up as a customer; once VIIPA gives them another role
 * (staff, a place's owner or receptionist, a restaurant's owner, manager or delivery) they are no longer one,
 * so they don't book stays or order food, until VIIPA makes them a customer again.
 */
export async function isCustomer(userId: string): Promise<boolean> {
  const user = await db.user.findFirst({
    where: { id: userId, role: "USER", isHost: false, isRestaurateur: false, listings: { none: {} }, placeMembers: { none: {} }, restaurantsOwned: { none: {} }, restaurantRoles: { none: {} } },
    select: { id: true },
  });
  return Boolean(user);
}
