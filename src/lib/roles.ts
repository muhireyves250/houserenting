/** Platform roles: customers and owners (USER), VIIPA staff (ADMIN), and staff who also manage staff (SUPER_ADMIN). */
export type AppRole = "USER" | "ADMIN" | "SUPER_ADMIN";
export const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;

/** The parts of the dashboard a staff member can be given, one per sidebar page. */
export const STAFF_AREAS = ["listings", "bookings", "messages", "food", "laundry", "support", "money", "promotions", "settings"] as const;
export type StaffArea = (typeof STAFF_AREAS)[number];
export const isStaffArea = (value: unknown): value is StaffArea => typeof value === "string" && (STAFF_AREAS as readonly string[]).includes(value);

type Person = { role?: string | null; staffAreas?: readonly string[] | null } | null | undefined;

/** VIIPA staff (any area). */
export function isAdmin(user: Person): boolean {
  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

export function isSuperAdmin(user: Person): boolean {
  return user?.role === "SUPER_ADMIN";
}

/**
 * Staff allowed to manage this part of the dashboard: super admins always; admins when given the area. Signed-in
 * people always carry their areas (from the session); a staff actor built inside the server without any (trusted
 * internal code, e.g. a scheduled job) counts as full staff.
 */
export function canStaff(user: Person, area: StaffArea): boolean {
  if (!isAdmin(user)) return false;
  if (user?.role === "SUPER_ADMIN" || user?.staffAreas == null) return true;
  return user.staffAreas.includes(area);
}

/** The areas this person can open (all of them for super admins). */
export function staffAreasOf(user: Person): StaffArea[] {
  return STAFF_AREAS.filter((area) => canStaff(user, area));
}
