import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { getCurrentUser } from "@/lib/session";

export default async function MainLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader user={user ? { name: user.name } : null} />
      <main className="min-h-dvh pb-12">{children}</main>
      <SiteFooter signedIn={Boolean(user)} />
      <BottomTabBar signedIn={Boolean(user)} />
      {modal}
    </>
  );
}
