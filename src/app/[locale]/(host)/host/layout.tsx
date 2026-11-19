import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import { ordersForHost } from "@/features/food/service";
import { HostShell } from "@/features/hosting/components/HostShell";
import { unreadCount } from "@/features/notifications/service";
import { redirect } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** The house owner's dashboard: its own frame (sidebar, top bar, phone bottom bar), outside the public site's header. */
export default async function HostLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/host");
  // Staff use the admin dashboard.
  if (isAdmin(user)) redirect({ href: "/admin", locale: await getLocale() });
  const [unread, kitchens, orders] = await Promise.all([
    unreadCount(user.id),
    db.restaurantMember.count({ where: { userId: user.id } }),
    ordersForHost(user.id),
  ]);
  return (
    <HostShell user={{ name: user.name, email: user.email }} kitchens={kitchens > 0} unread={unread} counts={{ orders: orders.filter((o) => o.status === "OUT_FOR_DELIVERY").length }}>
      {children}
    </HostShell>
  );
}
