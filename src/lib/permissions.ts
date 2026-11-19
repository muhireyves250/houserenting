import "server-only";
import { notFound } from "next/navigation";
import type { SessionUser } from "@/lib/auth";
import { requireUser } from "@/lib/session";

import { canStaff, isAdmin, type StaffArea } from "@/lib/roles";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export { canStaff, isAdmin };

/** Staff-only pages: signed-out visitors log in first; everyone else gets a plain 404 (the page doesn't exist for them). */
export async function requireAdmin(nextPath: string): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!isAdmin(user)) notFound();
  return user;
}

/** A staff page of one area: staff without that area go back to the overview (which says what they can open). */
export async function requireStaff(area: StaffArea, nextPath: string): Promise<SessionUser> {
  const user = await requireAdmin(nextPath);
  if (canStaff(user, area)) return user;
  const locale = await getLocale();
  return redirect({ href: { pathname: "/admin", query: { denied: area } }, locale });
}
