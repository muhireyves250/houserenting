/**
 * Where to go after signing in. Staff only use the admin dashboard, so they always land there (or on the admin page
 * they were heading to); everyone else goes where they were heading. `next` is a locale-less path.
 */
export function landingAfterLogin(next: string, role: string | null | undefined): string {
  if (role === "ADMIN") return next === "/admin" || next.startsWith("/admin/") ? next : "/admin";
  return next;
}
