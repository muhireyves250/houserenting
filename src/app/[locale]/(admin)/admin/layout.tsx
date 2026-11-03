import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/features/admin/components/AdminShell";
import { attentionCounts } from "@/features/admin/stats";
import { requireAdmin } from "@/lib/permissions";
import { Suspense } from "react";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";
import { unreadCount } from "@/features/notifications/service";
import { unreadChats } from "@/features/chats/service";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/** Staff area, outside the public site's header and tabs: every page under it is checked for the admin role on the server. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin("/admin");
  const [counts, unread, chats] = await Promise.all([attentionCounts(), unreadCount(user.id), unreadChats(user)]);
  return (
    <AdminShell
      user={{ name: user.name, email: user.email }}
      counts={{ listings: counts.listings, moderation: counts.moderation, support: counts.tickets, money: counts.payments + counts.rewards, requests: counts.requests + counts.refunds, messages: chats }}
      unread={unread}
      languageSwitcher={
        <Suspense>
          <LocaleSwitcher compact />
        </Suspense>
      }
    >
      {children}
    </AdminShell>
  );
}
