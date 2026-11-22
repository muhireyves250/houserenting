/**
 * Where to go after signing in. Staff only use the admin dashboard, so they always land there (or on the admin page
 * they were heading to). House owners likewise only use their dashboard (they don't book stays). Everyone else goes
 * where they were heading. `next` is a locale-less path.
 */
export function landingAfterLogin(next: string, role: string | null | undefined, isHost = false): string {
  if (role === "MANAGER" || role === "ADMIN" || role === "SUPER_ADMIN") return next === "/admin" || next.startsWith("/admin/") ? next : "/admin";
  if (isHost) return next === "/host" || next.startsWith("/host/") ? next : "/host";
  // No particular page asked for: /work opens their work dashboard when they have a role at a place or restaurant
  // (property manager, receptionist, restaurant team), else the home page.
  return next === "/" ? "/work" : next;
}
