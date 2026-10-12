import type { ReactNode } from "react";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { getCurrentUser } from "@/lib/session";

export default async function MainLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader user={user ? { name: user.name } : null} />
      <main className="min-h-dvh pb-24 md:pb-12">{children}</main>
      <BottomTabBar signedIn={Boolean(user)} />
      {modal}
    </>
  );
}
