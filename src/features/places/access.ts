import "server-only";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";

/** Someone's part in running a place. Staff can do everything; owners everything on their own places. */
export type PlaceRole = "staff" | "owner" | "manager" | "receptionist";
export type PlaceAction = "edit" | "status" | "blocks" | "rooms" | "documents" | "team" | "money" | "bookings" | "checkIn" | "requests" | "guestId";

const ALLOWED: Record<PlaceRole, readonly PlaceAction[]> = {
  staff: ["edit", "status", "blocks", "rooms", "documents", "team", "money", "bookings", "checkIn", "requests", "guestId"],
  owner: ["edit", "status", "blocks", "rooms", "documents", "team", "money", "bookings", "checkIn", "requests", "guestId"],
  manager: ["edit", "blocks", "rooms", "bookings", "checkIn", "requests", "guestId"],
  receptionist: ["bookings", "checkIn", "guestId"],
};

export function can(role: PlaceRole | null, action: PlaceAction): boolean {
  return role !== null && ALLOWED[role].includes(action);
}

/** The actor's role on one place, or null when they have none. */
export async function placeRole(actor: { id: string; role?: string | null }, listingId: string): Promise<PlaceRole | null> {
  if (isAdmin(actor)) return "staff";
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { hostId: true, team: { where: { userId: actor.id }, select: { role: true } } },
  });
  if (!listing) return null;
  if (listing.hostId === actor.id) return "owner";
  const member = listing.team[0]?.role;
  return member === "MANAGER" ? "manager" : member === "RECEPTIONIST" ? "receptionist" : null;
}

export async function canOn(actor: { id: string; role?: string | null }, listingId: string, action: PlaceAction): Promise<boolean> {
  return can(await placeRole(actor, listingId), action);
}

/** Places someone owns or helps run (staff get none here: they use the dashboard). */
export async function placesRunBy(userId: string) {
  const [owned, member] = await Promise.all([
    db.listing.findMany({ where: { hostId: userId, status: { not: "ARCHIVED" } }, select: { id: true } }),
    db.placeMember.findMany({ where: { userId, listing: { status: { not: "ARCHIVED" } } }, select: { listingId: true, role: true } }),
  ]);
  return { owned: owned.map((l) => l.id), member };
}
