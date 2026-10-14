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
 * The original welcome layout - illustration, blue title, text, progress, Next / Skip - with large animated
 * illustrations that draw themselves on every slide, text rising in and a stretching progress dot.
 */
export function OnboardingCarousel({ onFinish }: { onFinish: () => void }) {
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
        {/* Large illustration (keyed by slide so it draws itself again on every step). */}
        <div className="aspect-[4/3] w-full max-w-[22rem]">
          <Art key={index} />
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
          className={cn(
            "group inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-[16px] font-semibold text-white",
            "shadow-[0_12px_28px_-12px_rgba(0,87,184,0.85)] transition-[transform,background-color,box-shadow] duration-300",
            EASE,
            "hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_18px_34px_-12px_rgba(0,87,184,0.95)]",
            "active:translate-y-0 active:scale-[0.97] active:shadow-[0_6px_16px_-8px_rgba(0,87,184,0.9)]",
            "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
          )}
        >
          {last ? t("getStarted") : tCommon("next")}
          <ArrowRight className={cn("size-5 transition-transform duration-300 group-hover:translate-x-1 group-active:translate-x-1.5", EASE)} aria-hidden="true" />
        </button>
        {/* Same height on every slide so Next never jumps; Skip fades out on the last one. */}
        <button
          type="button"
          onClick={onFinish}
          tabIndex={last ? -1 : 0}
          aria-hidden={last || undefined}
          className={cn(
            "h-12 rounded-full text-[15px] font-semibold text-primary transition-[background-color,transform,opacity] duration-300",
            EASE,
            "hover:bg-primary/[0.08] active:scale-[0.96] active:bg-primary/[0.14]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            last && "pointer-events-none opacity-0",
          )}
        >
          {tCommon("skip")}
        </button>
      </div>
    </div>
  );
}
