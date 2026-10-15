import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { MobileTopBar } from "@/components/shell/MobileTopBar";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { isAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";

export default async function MainLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  const user = await getCurrentUser();
  // Staff only use the admin dashboard: every client page sends them there.
  if (user && isAdmin(user)) redirect({ href: "/admin", locale: await getLocale() });
  return (
    <>
      <SiteHeader user={user ? { name: user.name } : null} />
      <MobileTopBar />
      <main className="min-h-dvh pb-24 md:pb-12">{children}</main>
      <SiteFooter signedIn={Boolean(user)} />
      <BottomTabBar signedIn={Boolean(user)} />
      {modal}
    </>
  );
}
