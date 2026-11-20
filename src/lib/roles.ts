/**
 * Platform roles: customers and owners (USER); managers, VIIPA staff for the services they were given (MANAGER);
 * VIIPA admins, who manage everything (ADMIN); and those who also manage staff (SUPER_ADMIN).
 */
export type AppRole = "USER" | "MANAGER" | "ADMIN" | "SUPER_ADMIN";
export const STAFF_ROLES = ["MANAGER", "ADMIN", "SUPER_ADMIN"] as const;
export const ROLES = ["USER", "MANAGER", "ADMIN", "SUPER_ADMIN"] as const;

/** The parts of the dashboard a staff member can be given, one per sidebar page. */
export const STAFF_AREAS = ["listings", "bookings", "messages", "food", "laundry", "support", "money", "promotions", "settings"] as const;
export type StaffArea = (typeof STAFF_AREAS)[number];
export const isStaffArea = (value: unknown): value is StaffArea => typeof value === "string" && (STAFF_AREAS as readonly string[]).includes(value);

type Person = { role?: string | null; staffAreas?: readonly string[] | null } | null | undefined;

/** VIIPA staff of any kind (managers included): they use the dashboard. */
export function isAdmin(user: Person): boolean {
  return user?.role === "MANAGER" || user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

export function isSuperAdmin(user: Person): boolean {
  return user?.role === "SUPER_ADMIN";
}

/**
 * Staff allowed to manage this part of the dashboard: admins and super admins always; managers when given the area.
 * Signed-in people always carry their areas (from the session); a manager built inside the server without any
 * (trusted internal code) counts as full staff.
 */
export function canStaff(user: Person, area: StaffArea): boolean {
  if (!isAdmin(user)) return false;
  if (user?.role !== "MANAGER" || user?.staffAreas == null) return true;
  return user.staffAreas.includes(area);
}

/** The areas this person can open (all of them for super admins). */
export function staffAreasOf(user: Person): StaffArea[] {
  return STAFF_AREAS.filter((area) => canStaff(user, area));
}
