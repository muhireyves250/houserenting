import { getLocale } from "next-intl/server";
import { hasWork, workRoles } from "@/features/hosting/work";
import { redirect } from "@/i18n/navigation";
import { isAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

/** Opens the right dashboard for whoever signs in: staff, a role at a place or restaurant, or the home page. */
export default async function WorkPage() {
  const user = await getCurrentUser();
  const locale = await getLocale();
  if (!user) return redirect({ href: "/login", locale });
  if (isAdmin(user)) return redirect({ href: "/admin", locale });
  const work = await workRoles(user.id);
  redirect({ href: hasWork(work) ? work.home : "/", locale });
}
