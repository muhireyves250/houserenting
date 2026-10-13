"use client";

import { Building2, Heart, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const SLIDES = [
  { title: "slide1", body: "slide1Body", Icon: Building2 },
  { title: "slide2", body: "slide2Body", Icon: MapPin },
  { title: "slide3", body: "slide3Body", Icon: Heart },
] as const;

export function OnboardingCarousel({ onFinish }: { onFinish: () => void }) {
  const t = useTranslations("Onboarding");
  const tCommon = useTranslations("Common");
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-between bg-surface px-6 py-12 text-center">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex size-48 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden="true">
          <slide.Icon className="size-24" strokeWidth={1.25} />
        </div>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-primary">{t(slide.title)}</h1>
        <p className="max-w-xs text-muted">{t(slide.body)}</p>
        <div className="flex gap-1.5" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <span key={s.title} className={cn("h-1 w-6 rounded-full", i === index ? "bg-primary" : "bg-primary-soft")} />
          ))}
        </div>
        <span className="sr-only">{t("progress", { current: index + 1, total: SLIDES.length })}</span>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button size="lg" fullWidth onClick={() => (last ? onFinish() : setIndex(index + 1))}>
          {last ? t("getStarted") : tCommon("next")}
        </Button>
        {!last && (
          <Button variant="ghost" onClick={onFinish}>
            {tCommon("skip")}
          </Button>
        )}
      </div>
    </div>
  );
}
