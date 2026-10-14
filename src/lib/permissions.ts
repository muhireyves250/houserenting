import "server-only";
import { notFound } from "next/navigation";
import type { SessionUser } from "@/lib/auth";
import { requireUser } from "@/lib/session";

import { isAdmin } from "@/lib/roles";

export { isAdmin };

/** Staff-only pages: signed-out visitors log in first; everyone else gets a plain 404 (the page doesn't exist for them). */
export async function requireAdmin(nextPath: string): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (!isAdmin(user)) notFound();
  return user;
}
