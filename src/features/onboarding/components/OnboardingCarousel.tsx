"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { WELCOME_ART } from "./WelcomeArt";

const SLIDES = [
  { title: "slide1", body: "slide1Body" },
  { title: "slide2", body: "slide2Body" },
  { title: "slide3", body: "slide3Body" },
] as const;

const SWIPE_PX = 50;
const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

/**
 * The original welcome layout - round picture, blue title, text, progress, Next / Skip - with animated line
 * drawings that draw themselves on every slide, soft breathing rings, text rising in and a stretching dot.
 */
export function OnboardingCarousel({ onFinish, onLogin }: { onFinish: () => void; onLogin?: () => void }) {
  const t = useTranslations("Onboarding");
  const tCommon = useTranslations("Common");
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index];
  const Art = WELCOME_ART[index];

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
    <div className="welcome-fade flex min-h-dvh flex-col items-center justify-between bg-surface px-6 pt-[calc(3rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-center">
      <div
        data-testid="welcome-stage"
        className="flex w-full flex-1 touch-pan-y flex-col items-center justify-center gap-8"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {/* Round photo with softly breathing brand rings. */}
        <div className="relative flex size-64 items-center justify-center" aria-hidden="true">
          <span className="welcome-ring absolute inset-0 rounded-full bg-primary-soft" />
          <span className="welcome-ring absolute -inset-4 rounded-full bg-primary-soft/50 [animation-delay:600ms]" />
          <div className="relative flex size-56 items-center justify-center overflow-hidden rounded-full bg-surface p-6 shadow-[0_24px_50px_-20px_rgba(0,60,140,0.45)] ring-4 ring-surface">
            {/* Keyed by slide so the drawing animates in again each time. */}
            <Art key={index} />
          </div>
        </div>

        {/* Keyed by slide: the text rises in again on every step. */}
        <div key={slide.title} className="flex flex-col items-center gap-3">
          <h1 className="welcome-rise text-[28px] leading-tight font-bold tracking-[-0.03em] text-primary">{t(slide.title)}</h1>
          <p className="welcome-rise max-w-xs text-[16px] leading-6 text-muted [animation-delay:120ms]">{t(slide.body)}</p>
        </div>

        <div className="flex items-center gap-2" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <span
              key={s.title}
              className={cn(
                "h-2 rounded-full transition-[width,background-color] duration-500",
                EASE,
                i === index ? "w-8 bg-primary" : "w-2 bg-primary-soft",
              )}
            />
          ))}
        </div>
        <span className="sr-only">{t("progress", { current: index + 1, total: SLIDES.length })}</span>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <button
          type="button"
          onClick={() => (last ? onFinish() : go(index + 1))}
          className="group inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-[16px] font-semibold text-white shadow-[0_12px_28px_-12px_rgba(0,87,184,0.85)] transition-[transform,background-color] duration-300 hover:bg-primary-hover active:scale-[0.98]"
        >
          {last ? t("getStarted") : tCommon("next")}
          <ArrowRight className="size-5 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
        </button>
        {!last ? (
          <button type="button" onClick={onFinish} className="h-12 rounded-full text-[15px] font-semibold text-primary transition-colors hover:bg-primary/[0.06]">
            {tCommon("skip")}
          </button>
        ) : (
          onLogin && (
            <button type="button" onClick={onLogin} className="h-12 rounded-full text-[15px] font-semibold text-primary transition-colors hover:bg-primary/[0.06]">
              {t("haveAccount")}
            </button>
          )
        )}
      </div>
    </div>
  );
}
