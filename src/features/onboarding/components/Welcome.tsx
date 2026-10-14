"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { LogoReveal } from "./LogoReveal";
import { OnboardingCarousel } from "./OnboardingCarousel";

const INTRO_MS = 1800;
const INTRO_OUT_MS = 500;

/** Welcome page: the logo draws itself, then the introduction slides, then back to the page the visitor opened. */
export function Welcome({ next = "/" }: { next?: string }) {
  const router = useRouter();
  const target = safeNextPath(next);
  // Intro timeline: logo reveal, fade out, then the slides.
  const [intro, setIntro] = useState<"in" | "out" | null>("in");
  useEffect(() => {
    if (!intro) return;
    const timer = setTimeout(() => setIntro(intro === "in" ? "out" : null), intro === "in" ? INTRO_MS : INTRO_OUT_MS);
    return () => clearTimeout(timer);
  }, [intro]);

  return (
    <>
      {intro !== "in" && (
        <OnboardingCarousel
          onFinish={() => router.replace(target)}
          onLogin={() => router.replace({ pathname: "/login", query: { next: target } })}
        />
      )}
      {intro && <LogoReveal testId="logo-reveal" leaving={intro === "out"} />}
    </>
  );
}
