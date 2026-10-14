"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState, type PointerEvent } from "react";
import { LogoMark } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";

// Free Unsplash photos (already allowed by the CSP and next/image).
const SLIDES = [
  { title: "slide1", body: "slide1Body", photo: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750" },
  { title: "slide2", body: "slide2Body", photo: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267" },
  { title: "slide3", body: "slide3Body", photo: "https://images.unsplash.com/photo-1449844908441-8829872d2607" },
] as const;

const SWIPE_PX = 50;

/**
 * Full-screen welcome: each slide's photo slowly zooms (Ken Burns) and cross-fades, the text rises in with a
 * stagger, and the progress bar stretches to the current step. Swipe or Next to move on; Skip / Get started finish.
 */
export function OnboardingCarousel({ onFinish, onLogin }: { onFinish: () => void; onLogin?: () => void }) {
  const t = useTranslations("Onboarding");
  const tCommon = useTranslations("Common");
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const go = (next: number) => setIndex(Math.min(SLIDES.length - 1, Math.max(0, next)));
  const onPointerDown = (event: PointerEvent) => {
    startX.current = event.clientX;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (startX.current === null) return;
    const dx = event.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) >= SWIPE_PX) go(index + (dx < 0 ? 1 : -1));
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#00142e] text-white">
      {/* Photos: all mounted (no reload flash); the current one fades in and keeps zooming slowly. */}
      <div data-testid="welcome-stage" className="absolute inset-0 touch-pan-y" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        {SLIDES.map((s, i) => (
          <div
            key={s.photo}
            aria-hidden="true"
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
              i === index ? "opacity-100" : "opacity-0",
            )}
          >
            <Image
              src={s.photo}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className={cn("object-cover", i === index && "welcome-kenburns")}
            />
          </div>
        ))}
        {/* Brand-blue gradient for readable text. */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#00142e]/45 via-[#00214a]/30 to-[#00142e]/95" aria-hidden="true" />
      </div>

      {/* Top: logo and Skip */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <LogoMark className="welcome-pop h-9 w-10 text-white" />
        {!last && (
          <button
            type="button"
            onClick={onFinish}
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/25"
          >
            {tCommon("skip")}
          </button>
        )}
      </div>

      {/* Bottom: text, progress, actions */}
      <div className="relative z-10 mt-auto flex flex-col gap-6 px-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {/* Keyed by slide: the text animates in again on every step. */}
        <div key={slide.title} className="flex flex-col gap-3">
          <h1 className="welcome-rise text-[34px] leading-[1.1] font-bold tracking-[-0.03em]">{t(slide.title)}</h1>
          <p className="welcome-rise max-w-sm text-[16px] leading-6 text-white/85 [animation-delay:120ms]">{t(slide.body)}</p>
        </div>

        <div className="flex gap-2" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <span key={s.title} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <span
                className={cn(
                  "block h-full origin-left rounded-full bg-white transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  i <= index ? "scale-x-100" : "scale-x-0",
                )}
              />
            </span>
          ))}
        </div>
        <span className="sr-only">{t("progress", { current: index + 1, total: SLIDES.length })}</span>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => (last ? onFinish() : go(index + 1))}
            className="group inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-bold text-primary shadow-[0_14px_30px_-12px_rgba(0,0,0,0.6)] transition-transform duration-300 active:scale-[0.98]"
          >
            {last ? t("getStarted") : tCommon("next")}
            <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
          </button>
          {onLogin && (
            <button type="button" onClick={onLogin} className="h-12 rounded-full text-[15px] font-semibold text-white/90 underline-offset-4 hover:underline">
              {t("haveAccount")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
