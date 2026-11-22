"use client";

import { ChevronLeft, ChevronRight, LayoutGrid, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useModal } from "@/lib/use-modal";
import { cn } from "@/lib/cn";

type Photo = { id: string; url: string };

/** Phones: swipeable strip with a counter. Desktop: 1 large + 4 small mosaic. Either opens every photo. */
export function ListingPhotos({ title, photos }: { title: string; photos: Photo[] }) {
  const t = useTranslations("Listings");
  const [current, setCurrent] = useState(1);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const alt = (index: number) => t("photoAlt", { title, number: index + 1 });
  const mosaic = photos.slice(0, 5);

  return (
    <>
      {/* Phones */}
      <div className="relative -mx-4 md:hidden">
        <div
          ref={strip}
          className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          onScroll={(event) => {
            const el = event.currentTarget;
            setCurrent(Math.round(el.scrollLeft / el.clientWidth) + 1);
          }}
        >
          {photos.map((photo, index) => (
            <button key={photo.id} type="button" onClick={() => setViewerAt(index)} className="relative h-full w-full shrink-0 snap-center">
              <Image src={photo.url} alt={alt(index)} fill priority={index === 0} sizes="100vw" className="object-cover" />
            </button>
          ))}
        </div>
        {/* Arrows on the strip too (as well as swiping). */}
        {photos.length > 1 && (
          <>
            <button type="button" aria-label={t("previousPhoto")} onClick={() => strip.current?.scrollBy({ left: -strip.current.clientWidth, behavior: "smooth" })} className="absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow disabled:opacity-0" disabled={current === 1}>
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button type="button" aria-label={t("nextPhoto")} onClick={() => strip.current?.scrollBy({ left: strip.current.clientWidth, behavior: "smooth" })} className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow disabled:opacity-0" disabled={current === photos.length}>
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </>
        )}
        <span className="absolute right-3 bottom-9 rounded-full bg-ink/70 px-2.5 py-1 text-xs font-medium text-white tabular-nums">
          {t("photoCount", { current, total: photos.length })}
        </span>
      </div>

      {/* Desktop */}
      <div
        className={cn(
          "relative hidden h-[clamp(360px,42vw,520px)] gap-2 overflow-hidden rounded-2xl md:grid",
          mosaic.length >= 5 ? "grid-cols-4 grid-rows-2" : mosaic.length >= 3 ? "grid-cols-3 grid-rows-2" : "grid-cols-2",
        )}
      >
        {mosaic.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setViewerAt(index)}
            className={cn("group relative overflow-hidden bg-canvas", index === 0 && mosaic.length >= 3 && "col-span-2 row-span-2")}
          >
            <Image
              src={photo.url}
              alt={alt(index)}
              fill
              priority={index === 0}
              sizes={index === 0 ? "(min-width: 1280px) 640px, 50vw" : "(min-width: 1280px) 320px, 25vw"}
              className="object-cover transition-[transform,filter] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.03] group-hover:brightness-90"
            />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setViewerAt(0)}
          className="absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-lg border border-ink/80 max-md:border-primary bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-[transform,background-color] duration-300 hover:bg-canvas active:scale-95"
        >
          <LayoutGrid className="size-4" aria-hidden="true" />
          {t("showAllPhotos")}
        </button>
      </div>

      {viewerAt !== null && <PhotoViewer title={title} photos={photos} startAt={viewerAt} onClose={() => setViewerAt(null)} />}
    </>
  );
}

/** Full-screen slider: one photo at a time with arrows (and the keyboard's arrow keys), a counter and thumbnails. */
function PhotoViewer({ title, photos, startAt, onClose }: { title: string; photos: Photo[]; startAt: number; onClose: () => void }) {
  const t = useTranslations("Listings");
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(startAt);
  useModal(ref, onClose);
  const go = (by: number) => setAt((i) => (i + by + photos.length) % photos.length);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setAt((i) => (i + 1) % photos.length);
      if (e.key === "ArrowLeft") setAt((i) => (i - 1 + photos.length) % photos.length);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [photos.length]);

  useEffect(() => {
    ref.current?.querySelector(`[data-thumb="${at}"]`)?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }, [at]);

  const photo = photos[at]!;
  const arrow = "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-lg transition-transform hover:scale-105 active:scale-95";
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label={t("allPhotos")} className="fixed inset-0 z-[60] flex flex-col bg-[#0b1220] text-white motion-safe:animate-[fade-in_250ms_ease-out]">
      <div className="flex items-center justify-between px-4 py-3 md:px-8">
        <button type="button" aria-label={t("closePhotos")} onClick={onClose} className="flex size-10 items-center justify-center rounded-full hover:bg-white/10">
          <X className="size-5" aria-hidden="true" />
        </button>
        <h2 aria-live="polite" className="text-[14px] font-semibold tabular-nums">
          {t("photoCount", { current: at + 1, total: photos.length })}
        </h2>
        <span className="w-10" aria-hidden="true" />
      </div>
      <div className="relative min-h-0 flex-1">
        <Image key={photo.id} src={photo.url} alt={t("photoAlt", { title, number: at + 1 })} fill sizes="100vw" className="object-contain motion-safe:animate-[fade-in_200ms_ease-out]" />
        {photos.length > 1 && (
          <>
            <button type="button" aria-label={t("previousPhoto")} onClick={() => go(-1)} className={`${arrow} left-3 md:left-6`}>
              <ChevronLeft className="size-6" aria-hidden="true" />
            </button>
            <button type="button" aria-label={t("nextPhoto")} onClick={() => go(1)} className={`${arrow} right-3 md:right-6`}>
              <ChevronRight className="size-6" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3 md:justify-center md:px-8" data-lenis-prevent>
        {photos.map((p, index) => (
          <button
            key={p.id}
            type="button"
            data-thumb={index}
            aria-label={t("photoAlt", { title, number: index + 1 })}
            aria-current={index === at}
            onClick={() => setAt(index)}
            className={cn("relative h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition-opacity", index === at ? "ring-white" : "opacity-60 ring-transparent hover:opacity-100")}
          >
            <Image src={p.url} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
