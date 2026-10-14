import { Suspense, type ReactNode } from "react";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { MobileTopBar } from "@/components/shell/MobileTopBar";
import { WelcomeGate } from "@/features/onboarding/components/WelcomeGate";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/session";

export default async function MainLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  const user = await getCurrentUser();
  // A hard refresh asks for fresh content; a normal refresh doesn't (it may send max-age=0).
  const cacheControl = (await headers()).get("cache-control") ?? "";
  const hardReload = /no-cache/i.test(cacheControl) || /no-cache/i.test((await headers()).get("pragma") ?? "");
  return (
    <>
      <Suspense>
        <WelcomeGate hardReload={hardReload} />
      </Suspense>
      <SiteHeader user={user ? { name: user.name } : null} />
      <MobileTopBar />
      <main className="min-h-dvh pb-24 md:pb-12">{children}</main>
      <SiteFooter signedIn={Boolean(user)} />
      <BottomTabBar signedIn={Boolean(user)} />
      {modal}
    </>
  );
}
