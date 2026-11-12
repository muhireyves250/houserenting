import { BedDouble, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * A compact row for a lodge's room type or room: photo on the left, name, a short line, whether it's free, the
 * price. Small enough that several fit on a phone screen.
 */
export function RoomRowCard({
  href,
  photo,
  title,
  details,
  status,
  free,
  price,
  note,
}: {
  href: string;
  photo: string | null;
  title: string;
  details?: ReactNode;
  status: string;
  free: boolean;
  price?: ReactNode;
  note?: string | null;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl bg-surface p-2.5 pr-3 shadow-[0_8px_24px_-16px_rgba(16,24,40,0.35)] ring-1 ring-line transition-transform active:scale-[0.99]"
    >
      <span className="relative block size-[84px] shrink-0 overflow-hidden rounded-xl bg-primary-soft">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- room photo (Cloudinary/Unsplash)
          <img src={photo} alt="" loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <BedDouble className="absolute inset-0 m-auto size-7 text-primary" aria-hidden="true" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="truncate text-[16px] font-bold text-ink">{title}</b>
        <span className="flex flex-wrap items-center gap-x-2 text-[12px]">
          {details && <span className="inline-flex items-center gap-1 text-muted">{details}</span>}
          <span className={cn("font-semibold", free ? "text-emerald-700" : "text-red-700")}>{status}</span>
        </span>
        {note && <span className="truncate text-[12px] text-muted">{note}</span>}
        {price && <span className="text-[13px] text-ink">{price}</span>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-ink/40" aria-hidden="true" />
    </Link>
  );
}
