import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { MobileTopBar } from "@/components/shell/MobileTopBar";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { ordersLive } from "@/features/food/service";
import { hasWork, workRoles } from "@/features/hosting/work";
import { isAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function MainLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  const user = await getCurrentUser();
  // Only customers see the client pages. Everyone with another role (VIIPA staff; a place's owner or receptionist;
  // a restaurant's owner, manager or delivery person) only ever sees their own dashboard.
  if (user && isAdmin(user)) redirect({ href: "/admin", locale: await getLocale() });
  if (user) {
    const work = await workRoles(user.id);
    if (hasWork(work)) redirect({ href: work.home, locale: await getLocale() });
  }
  const orders = await ordersLive();
  return (
    <>
      <SiteHeader user={user ? { name: user.name, image: user.image } : null} orders={orders} />
      <MobileTopBar />
      <main className="min-h-dvh pb-24 md:pb-12">{children}</main>
      <SiteFooter signedIn={Boolean(user)} />
      <BottomTabBar signedIn={Boolean(user)} />
      {modal}
    </>
  );
}
