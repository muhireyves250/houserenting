import "server-only";
import { db } from "@/lib/db";
import { canStaff, type StaffArea } from "@/lib/roles";

/** Someone's part in running a place. Staff can do everything; owners everything on their own places. */
export type PlaceRole = "staff" | "owner" | "manager" | "receptionist";
export type PlaceAction = "edit" | "status" | "blocks" | "rooms" | "documents" | "team" | "money" | "bookings" | "checkIn" | "requests" | "guestId" | "laundry";

const ALLOWED: Record<PlaceRole, readonly PlaceAction[]> = {
  staff: ["edit", "status", "blocks", "rooms", "documents", "team", "money", "bookings", "checkIn", "requests", "guestId", "laundry"],
  // Owners add places (editing until sent for review), block dates, upload papers and see their earnings.
  // Bookings, guests and the front desk are VIIPA's alone.
  // Once VIIPA accepts a guest's laundry, the place's owner (or manager) collects, washes and returns it.
  owner: ["edit", "blocks", "rooms", "documents", "money", "laundry"],
  manager: ["edit", "blocks", "rooms", "laundry"],
  receptionist: [],
};

export function can(role: PlaceRole | null, action: PlaceAction): boolean {
  return role !== null && ALLOWED[role].includes(action);
}

/** The actor's role on one place, or null when they have none. */
export async function placeRole(actor: { id: string; role?: string | null; staffAreas?: readonly string[] | null }, listingId: string): Promise<PlaceRole | null> {
  if (canStaff(actor, "listings")) return "staff";
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    // A team member's access starts once their email is confirmed.
    select: { hostId: true, team: { where: { userId: actor.id, user: { emailVerified: true, status: "ACTIVE" } }, select: { role: true } } },
  });
  if (!listing) return null;
  if (listing.hostId === actor.id) return "owner";
  const member = listing.team[0]?.role;
  return member === "MANAGER" ? "manager" : member === "RECEPTIONIST" ? "receptionist" : null;
}

/** Which part of the dashboard a staff member needs for each action on a place. */
const STAFF_AREA: Record<PlaceAction, StaffArea> = {
  edit: "listings",
  status: "listings",
  blocks: "listings",
  rooms: "listings",
  documents: "listings",
  team: "listings",
  money: "money",
  bookings: "bookings",
  checkIn: "bookings",
  requests: "bookings",
  guestId: "bookings",
  laundry: "laundry",
};

export async function canOn(actor: { id: string; role?: string | null; staffAreas?: readonly string[] | null }, listingId: string, action: PlaceAction): Promise<boolean> {
  // Staff given the matching area can do it on every place.
  if (canStaff(actor, STAFF_AREA[action])) return true;
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
