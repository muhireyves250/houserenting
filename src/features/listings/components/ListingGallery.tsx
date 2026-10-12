"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/cn";

type Photo = { id: string; url: string };

/** Mobile: swipeable strip with a counter. Desktop: 1 large + 4 small mosaic. */
export function ListingGallery({ title, photos }: { title: string; photos: Photo[] }) {
  const t = useTranslations("Listings");
  const [current, setCurrent] = useState(1);
  const alt = (index: number) => t("photoAlt", { title, number: index + 1 });

  return (
    <>
      <div className="relative -mx-4 md:hidden">
        <div
          className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
          onScroll={(event) => {
            const el = event.currentTarget;
            setCurrent(Math.round(el.scrollLeft / el.clientWidth) + 1);
          }}
        >
          {photos.map((photo, index) => (
            <div key={photo.id} className="relative h-full w-full shrink-0 snap-center">
              <Image src={photo.url} alt={alt(index)} fill priority={index === 0} sizes="100vw" className="object-cover" />
            </div>
          ))}
        </div>
        <span className="absolute right-3 bottom-3 rounded-md bg-ink/70 px-2 py-0.5 text-xs text-white">
          {t("photoCount", { current, total: photos.length })}
        </span>
      </div>

      <div className="hidden h-[440px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-card md:grid">
        {photos.slice(0, 5).map((photo, index) => (
          <div key={photo.id} className={cn("relative bg-canvas", index === 0 && "col-span-2 row-span-2")}>
            <Image
              src={photo.url}
              alt={alt(index)}
              fill
              priority={index === 0}
              sizes={index === 0 ? "640px" : "320px"}
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </>
  );
}
