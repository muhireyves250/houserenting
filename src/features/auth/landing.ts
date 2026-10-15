/**
 * Where to go after signing in: staff without a particular destination (home, or the Profile tab) land on the admin
 * dashboard; everyone else goes where they were heading. `next` is a locale-less path.
 */
export function landingAfterLogin(next: string, role: string | null | undefined): string {
  if (role === "ADMIN" && (next === "/" || next === "/profile")) return "/admin";
  return next;
}
