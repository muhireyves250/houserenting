"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { ONBOARDED_COOKIE } from "../constants";

export function OnboardingGate() {
  const router = useRouter();
  useEffect(() => {
    const done = document.cookie.split("; ").some((c) => c.startsWith(`${ONBOARDED_COOKIE}=`));
    if (!done && window.matchMedia("(max-width: 767px)").matches) router.replace("/welcome");
  }, [router]);
  return null;
}
