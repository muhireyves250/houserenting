import { House } from "lucide-react";
import Image from "next/image";

export type PlacePreviewData = { title: string; subtitle: string; photo: string | null };

/** The listing at the top of the Share / Save windows: thumbnail, name and a one-line summary. */
export function PlacePreview({ title, subtitle, photo }: PlacePreviewData) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-canvas p-3">
      <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
        {photo ? <Image src={photo} alt="" fill sizes="64px" className="object-cover" /> : <House className="size-6" aria-hidden="true" />}
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate text-[15px] font-semibold text-ink">{title}</span>
        <span className="block truncate text-sm text-muted">{subtitle}</span>
      </span>
    </div>
  );
}
