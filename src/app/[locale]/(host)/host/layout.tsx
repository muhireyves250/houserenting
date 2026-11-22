import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";
import { getLocale } from "next-intl/server";
import { ordersForHost } from "@/features/food/service";
import { workRoles } from "@/features/hosting/work";
import { HostShell } from "@/features/hosting/components/HostShell";
import { placeLaundryToDo } from "@/features/laundry/service";
import { unreadCount } from "@/features/notifications/service";
import { redirect } from "@/i18n/navigation";
import { isAdmin } from "@/lib/roles";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** The house owner's dashboard: its own frame (sidebar, top bar, phone bottom bar), outside the public site's header. */
export default async function HostLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  const user = await requireUser("/host");
  // Staff use the admin dashboard.
  if (isAdmin(user)) redirect({ href: "/admin", locale: await getLocale() });
  const [unread, work, orders, laundry] = await Promise.all([
    unreadCount(user.id),
    workRoles(user.id),
    ordersForHost(user.id),
    placeLaundryToDo(user.id),
  ]);
  return (
    <HostShell
      user={{ name: user.name, email: user.email }}
      // Each role sees only its own pages; someone with no role yet still sees the owner's start (to add a place).
      areas={work.areas.length > 0 ? work.areas : ["overview", "places"]}
      home={work.home}
      unread={unread}
      counts={{ orders: orders.filter((o) => o.status === "OUT_FOR_DELIVERY").length, laundry }}
      languageSwitcher={
        <Suspense>
          <LocaleSwitcher compact />
        </Suspense>
      }
    >
      {children}
      {/* Account and notices open as a panel over the current page. */}
      {modal}
    </HostShell>
  );
}
