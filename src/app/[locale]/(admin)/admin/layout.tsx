import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin/components/AdminShell";
import { adminBadges } from "@/features/admin/stats";
import { requireAdmin } from "@/lib/permissions";
import { staffAreasOf } from "@/lib/roles";
import { Suspense } from "react";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/** Staff area, outside the public site's header and tabs: every page under it is checked for the admin role on the server. */
export default async function AdminLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  const user = await requireAdmin("/admin");
  // All the sidebar and bell numbers in one database trip.
  const counts = await adminBadges(user.id);
  const unread = counts.unread;
  return (
    <AdminShell
      user={{ name: user.name, email: user.email }}
      areas={staffAreasOf(user)}
      counts={{ listings: counts.listings, support: counts.tickets + counts.moderation, money: counts.payments + counts.rewards, bookings: counts.requests + counts.refunds, messages: counts.messages, laundry: counts.laundry, orders: counts.orders }}
      unread={unread}
      languageSwitcher={
        <Suspense>
          <LocaleSwitcher compact />
        </Suspense>
      }
    >
      {children}
      {/* Add/edit windows opened from a staff page (intercepted routes). */}
      {modal}
    </AdminShell>
  );
}
