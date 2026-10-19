/** Platform roles: customers and owners (USER), VIIPA staff (ADMIN), and staff who also manage staff (SUPER_ADMIN). */
export type AppRole = "USER" | "ADMIN" | "SUPER_ADMIN";
export const STAFF_ROLES = ["ADMIN", "SUPER_ADMIN"] as const;

export function isAdmin(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}

export function isSuperAdmin(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === "SUPER_ADMIN";
}
