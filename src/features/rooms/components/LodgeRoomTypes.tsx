import { BedDouble, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { roomStatusOn } from "@/features/rooms/availability";
import { discountedPrice } from "@/features/listings/pricing";
import type { BookedRange } from "@/features/search/date-range";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";

type RoomType = { id: string; name: string; description: string; maxGuests: number; photos: string[]; numbers: string[]; rates: { unit: "HOUR" | "DAY" | "NIGHT" | "WEEK" | "MONTH" | "YEAR"; price: number }[] };
type Taken = BookedRange & { roomId: string | null };
type NumberTaken = { roomId: string; roomNumber: string; checkIn: string; checkOut: string };

/** How many rooms of a type are free on a day (a type without numbers is one room). */
export function freeRoomsOn(type: RoomType, booked: Taken[], numbers: NumberTaken[], day: string): number {
  if (type.numbers.length <= 1) return roomStatusOn(booked, type.id, day).free ? 1 : 0;
  // Whole-place bookings or blocks on the type take every room.
  if (booked.some((b) => (b.roomId === null || b.roomId === type.id) && b.checkIn <= day && day < b.checkOut && !roomStatusOn(booked, type.id, day).free)) return 0;
  return type.numbers.filter((n) => !numbers.some((b) => b.roomId === type.id && b.roomNumber === n && b.checkIn <= day && day < b.checkOut)).length;
}

/** A lodge's room types as cards (photo, rooms, price, rooms free today); each opens the type's own page. */
export async function LodgeRoomTypes({
  basePath,
  types,
  booked,
  numbers,
  today,
  fallbackPhoto,
  discountPercent,
}: {
  basePath: string;
  types: RoomType[];
  booked: Taken[];
  numbers: NumberTaken[];
  today: string;
  fallbackPhoto: string | null;
  discountPercent: number | null;
}) {
  const [t, tListings, locale] = await Promise.all([getTranslations("Rooms"), getTranslations("Listings"), getLocale()]);
  return (
    <section id="room-types" className="scroll-mt-28 pb-8 md:border-t md:border-line md:pt-10">
      <h2 className="mb-5 font-display text-[22px] leading-7 font-bold tracking-[-0.02em] text-ink">{t("roomTypesTitle")}</h2>
      {/* Compact rows so every type fits on a phone screen. */}
      <ul className="grid gap-3 md:grid-cols-2">
        {types.map((type) => {
          const total = Math.max(1, type.numbers.length);
          const free = freeRoomsOn(type, booked, numbers, today);
          const cheapest = [...type.rates].sort((a, b) => a.price - b.price)[0];
          const photo = type.photos[0] ?? fallbackPhoto;
          return (
            <li key={type.id}>
              <Link
                href={`${basePath}/rooms/${type.id}`}
                className="group flex items-center gap-3 rounded-2xl bg-surface p-2.5 pr-3 shadow-[0_8px_24px_-16px_rgba(16,24,40,0.35)] ring-1 ring-line transition-transform active:scale-[0.99]"
              >
                <span className="relative block size-[84px] shrink-0 overflow-hidden rounded-xl bg-primary-soft">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- room type photo (Cloudinary/Unsplash)
                    <img src={photo} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <BedDouble className="absolute inset-0 m-auto size-7 text-primary" aria-hidden="true" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <b className="truncate text-[16px] font-bold text-ink">{type.name}</b>
                  <span className="flex flex-wrap items-center gap-x-2 text-[12px]">
                    <span className="inline-flex items-center gap-1 text-muted">
                      <BedDouble className="size-3.5" aria-hidden="true" />
                      {t("roomsCount", { count: total })}
                    </span>
                    <span className={cn("font-semibold", free > 0 ? "text-emerald-700" : "text-red-700")}>
                      {total > 1 ? t("freeTodayCount", { free, total }) : free > 0 ? t("availableOn", { day: t("today") }) : t("bookedOn", { day: t("today") })}
                    </span>
                  </span>
                  {cheapest && (
                    <span className="text-[13px] text-ink">
                      {t("fromPrice")} <b className="font-bold">{formatRWF(discountedPrice(cheapest.price, discountPercent), locale)}</b> {tListings(`perUnit.${cheapest.unit}`)}
                    </span>
                  )}
                </span>
                <ChevronRight className="size-5 shrink-0 text-ink/40" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
