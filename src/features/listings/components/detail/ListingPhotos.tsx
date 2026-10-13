"use client";

import { LayoutGrid, X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { useModal } from "@/lib/use-modal";
import { cn } from "@/lib/cn";

type Photo = { id: string; url: string };

/** Phones: swipeable strip with a counter. Desktop: 1 large + 4 small mosaic. Either opens every photo. */
export function ListingPhotos({ title, photos }: { title: string; photos: Photo[] }) {
  const t = useTranslations("Listings");
  const [current, setCurrent] = useState(1);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const alt = (index: number) => t("photoAlt", { title, number: index + 1 });
  const mosaic = photos.slice(0, 5);

  return (
    <>
      {/* Phones */}
      <div className="relative -mx-4 md:hidden">
        <div
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
          className="absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-lg border border-ink/80 bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-[transform,background-color] duration-300 hover:bg-canvas active:scale-95"
        >
          <LayoutGrid className="size-4" aria-hidden="true" />
          {t("showAllPhotos")}
        </button>
      </div>

      {viewerAt !== null && <PhotoViewer title={title} photos={photos} startAt={viewerAt} onClose={() => setViewerAt(null)} />}
    </>
  );
}

/** Full-screen scroll of every photo, starting at the one clicked. */
function PhotoViewer({ title, photos, startAt, onClose }: { title: string; photos: Photo[]; startAt: number; onClose: () => void }) {
  const t = useTranslations("Listings");
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModal(ref, onClose);

  useEffect(() => {
    ref.current?.querySelector(`[data-photo="${startAt}"]`)?.scrollIntoView?.({ block: "center" });
  }, [startAt]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[60] overflow-y-auto bg-surface motion-safe:animate-[fade-in_250ms_ease-out]"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line/70 bg-surface/90 px-4 py-3 backdrop-blur-md md:px-8">
        <button
          type="button"
          aria-label={t("closePhotos")}
          onClick={onClose}
          className="flex size-10 items-center justify-center rounded-full transition-colors hover:bg-canvas"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        <h2 id={titleId} className="font-display text-base font-bold">
          {t("allPhotos")}
        </h2>
        <span className="w-10" aria-hidden="true" />
      </div>
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-2 px-4 py-8 md:px-8">
        {photos.map((photo, index) => (
          // Every third photo spans the full width, the rest pair up: a calm editorial rhythm.
          <div key={photo.id} data-photo={index} className={cn("relative overflow-hidden rounded-lg bg-canvas", index % 3 === 0 ? "col-span-2 aspect-[3/2]" : "aspect-square")}>
            <Image src={photo.url} alt={t("photoAlt", { title, number: index + 1 })} fill sizes="(min-width: 896px) 896px, 100vw" className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
