import { BedDouble, ChevronRight, Users } from "lucide-react";
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

/** A lodge's room types as cards (photo, price, guests, rooms free today); each opens the type's own page. */
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
    <section id="room-types" className="scroll-mt-28 border-t border-line py-10">
      <h2 className="font-display text-[22px] leading-7 font-bold tracking-[-0.02em] text-ink">{t("roomTypesTitle")}</h2>
      <p className="mt-1 mb-5 text-sm text-muted">{t("roomTypesIntro")}</p>
      <ul className="grid gap-4 sm:grid-cols-2">
        {types.map((type) => {
          const total = Math.max(1, type.numbers.length);
          const free = freeRoomsOn(type, booked, numbers, today);
          const cheapest = [...type.rates].sort((a, b) => a.price - b.price)[0];
          const photo = type.photos[0] ?? fallbackPhoto;
          return (
            <li key={type.id}>
              <Link href={`${basePath}/rooms/${type.id}`} className="group block overflow-hidden rounded-3xl bg-surface shadow-[0_10px_30px_-14px_rgba(16,24,40,0.3)] ring-1 ring-line transition-transform active:scale-[0.99]">
                <span className="relative block aspect-[16/10] bg-primary-soft">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- room type photo (Cloudinary/Unsplash)
                    <img src={photo} alt="" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <BedDouble className="absolute inset-0 m-auto size-10 text-primary" aria-hidden="true" />
                  )}
                  <span className={cn("absolute top-3 left-3 rounded-full px-2.5 py-1 text-[12px] font-bold shadow", free > 0 ? "bg-white text-emerald-800" : "bg-white text-red-700")}>
                    {total > 1 ? t("freeTodayCount", { free, total }) : free > 0 ? t("availableOn", { day: t("today") }) : t("bookedOn", { day: t("today") })}
                  </span>
                </span>
                <span className="flex items-end justify-between gap-3 p-4">
                  <span className="min-w-0">
                    <b className="block truncate text-[17px] font-bold text-ink">{type.name}</b>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" aria-hidden="true" />
                        {t("guests", { count: type.maxGuests })}
                      </span>
                      {total > 1 && <span>{t("roomsCount", { count: total })}</span>}
                    </span>
                    {cheapest && (
                      <span className="mt-1 block text-[14px] text-ink">
                        {t("fromPrice")} <b className="font-bold">{formatRWF(discountedPrice(cheapest.price, discountPercent), locale)}</b> {tListings(`perUnit.${cheapest.unit}`)}
                      </span>
                    )}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-3.5 py-2 text-[13px] font-semibold text-white">
                    {t("seeRooms")}
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
