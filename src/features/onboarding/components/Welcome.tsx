"use client";

import { useRouter } from "@/i18n/navigation";
import { ONBOARDED_COOKIE } from "../constants";
import { OnboardingCarousel } from "./OnboardingCarousel";

export function Welcome() {
  const router = useRouter();
  return (
    <OnboardingCarousel
      onFinish={() => {
        document.cookie = `${ONBOARDED_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
        router.replace("/");
      }}
    />
  );
}
