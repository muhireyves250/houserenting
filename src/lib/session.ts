import "server-only";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { auth, type SessionUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

/** Returns the signed-in user or redirects to /login?next=<nextPath>. `nextPath` excludes the locale. */
export async function requireUser(nextPath: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (user) return user;
  const locale = await getLocale();
  return redirect({ href: { pathname: "/login", query: { next: safeNextPath(nextPath) } }, locale });
}
