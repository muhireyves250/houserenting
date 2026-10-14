/** Roles enabled at launch: customers/hosts (USER) and platform staff (ADMIN). */
export type AppRole = "USER" | "ADMIN";

export function isAdmin(user: { role?: string | null } | null | undefined): boolean {
  return user?.role === "ADMIN";
}
