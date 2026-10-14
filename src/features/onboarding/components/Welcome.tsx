"use client";

import { useRouter } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { OnboardingCarousel } from "./OnboardingCarousel";

/** Welcome page: the introduction, then back to the page the visitor opened (or to log in). */
export function Welcome({ next = "/" }: { next?: string }) {
  const router = useRouter();
  const target = safeNextPath(next);
  return (
    <OnboardingCarousel
      onFinish={() => router.replace(target)}
      onLogin={() => router.replace({ pathname: "/login", query: { next: target } })}
    />
  );
}
