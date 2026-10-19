import { ChevronRight, House } from "lucide-react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { BookingStatus } from "../status";
import { StatusBadge } from "./StatusBadge";

/** Everything a booking card shows, already worded and formatted on the server. */
export type BookingTileData = {
  reference: string;
  status: BookingStatus;
  statusLabel: string;
  title: string;
  place: string;
  photo: string | null;
  dates: string;
  meta: string;
  note: string | null;
  /** The booking's total, formatted. */
  total?: string;
};

export function BookingTile({ booking }: { booking: BookingTileData }) {
  return (
    <Link
      href={`/bookings/${booking.reference}`}
      className="group flex gap-4 rounded-3xl bg-surface p-3 shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-black/[0.04] transition-[box-shadow,transform] duration-300 hover:shadow-[0_16px_36px_-14px_rgba(16,24,40,0.4)] active:scale-[0.98] max-md:ring-line"
    >
      <span className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary">
        {booking.photo ? (
          <Image src={booking.photo} alt="" fill sizes="96px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <House className="size-7" aria-hidden="true" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1 py-1 pr-1">
        <StatusBadge status={booking.status} label={booking.statusLabel} className="self-start" />
        <span className="line-clamp-2 text-[15px] leading-5 font-semibold text-ink">{booking.title}</span>
        <span className="truncate text-[13px] text-muted">{booking.place}</span>
        <span className="text-[13px] text-ink/80">{booking.dates}</span>
        <span className="text-[13px] text-ink/80">
          {booking.meta}
          {booking.total && <b className="font-semibold text-ink"> · {booking.total}</b>}
        </span>
        {booking.note && <span className="text-xs font-medium text-amber-800">{booking.note}</span>}
      </span>
      <ChevronRight className="size-4 shrink-0 self-center text-ink/40" aria-hidden="true" />
    </Link>
  );
}
