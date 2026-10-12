"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Decorative looping background video for the desktop hero. Skipped on phones (mobile data),
 * for reduced-motion users and with Save-Data on; the photo underneath stays as the fallback.
 * It fades in once it can play, so the hero never flashes empty.
 */
export function HeroVideo({ src, className }: { src: string; className?: string }) {
  const desktop = useMediaQuery("(min-width: 768px)", false);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
  const [ready, setReady] = useState(false);

  if (!desktop || reduceMotion) return null;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  if (saveData) return null;

  return (
    <video
      ref={(el) => {
        // React doesn't reliably reflect `muted`; browsers only autoplay muted video.
        if (el) el.muted = true;
      }}
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
      tabIndex={-1}
      onCanPlay={() => setReady(true)}
      className={cn(
        "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-out motion-reduce:transition-none",
        ready ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
