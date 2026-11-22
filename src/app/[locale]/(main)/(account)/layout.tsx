import type { ReactNode } from "react";
import { AccountNav } from "@/components/shell/AccountNav";
import { hasWork, workRoles } from "@/features/hosting/work";
import { unreadCount } from "@/features/notifications/service";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

/**
 * The guest's account pages. Computers: the account menu on the left and the page beside it, using the full width
 * (each page's own narrow phone column is widened by `.account-page`). Phones: unchanged.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return children;
  const [unread, image, work] = await Promise.all([unreadCount(user.id), db.user.findUnique({ where: { id: user.id }, select: { image: true } }).then((u) => u?.image ?? null), workRoles(user.id)]);
  return (
    <div className="lg:mx-auto lg:grid lg:max-w-7xl lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 lg:px-6 lg:py-10">
      <AccountNav user={{ name: user.name, email: user.email, image }} unread={unread} work={hasWork(work) ? work.home : null} />
      <div className="account-page admin-cards min-w-0">{children}</div>
    </div>
  );
}
