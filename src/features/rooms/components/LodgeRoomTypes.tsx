import { BedDouble } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { roomStatusOn } from "@/features/rooms/availability";
import { discountedPrice } from "@/features/listings/pricing";
import type { BookedRange } from "@/features/search/date-range";
import { formatRWF } from "@/lib/format";
import { RoomRowCard } from "./RoomRowCard";

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
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {types.map((type) => {
          const total = Math.max(1, type.numbers.length);
          const free = freeRoomsOn(type, booked, numbers, today);
          const cheapest = [...type.rates].sort((a, b) => a.price - b.price)[0];
          const photo = type.photos[0] ?? fallbackPhoto;
          return (
            <li key={type.id}>
              <RoomRowCard
                href={`${basePath}/rooms/${type.id}`}
                photo={photo}
                title={type.name}
                details={
                  <>
                    <BedDouble className="size-3.5" aria-hidden="true" />
                    {t("roomsCount", { count: total })}
                  </>
                }
                free={free > 0}
                status={total > 1 ? t("freeTodayCount", { free, total }) : free > 0 ? t("availableOn", { day: t("today") }) : t("bookedOn", { day: t("today") })}
                price={
                  cheapest && (
                    <>
                      {t("fromPrice")} <b className="font-bold">{formatRWF(discountedPrice(cheapest.price, discountPercent), locale)}</b> {tListings(`perUnit.${cheapest.unit}`)}
                    </>
                  )
                }
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
