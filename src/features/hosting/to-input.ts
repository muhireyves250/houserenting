import type { HostListing } from "./service";
import type { ListingInput } from "./validation";

const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

/** A saved listing as the values the listing form edits. */
export function toListingInput(listing: HostListing): ListingInput {
  return {
    title: listing.title,
    description: listing.description,
    // Older kinds are edited as today's: a lodge as a guest house, a room as an apartment, the rest as a house.
    type: listing.type === "LODGE" ? "GUEST_HOUSE" : listing.type === "ROOM" ? "APARTMENT" : listing.type === "DUPLEX" || listing.type === "OTHER" ? "PRIVATE_HOUSE" : listing.type,
    bookingModel: listing.bookingModel,
    addressLine: listing.addressLine,
    district: listing.district,
    city: listing.city,
    villageCode: listing.villageCode ?? "",
    province: listing.province,
    sector: listing.sector,
    cell: listing.cell,
    village: listing.village,
    lat: listing.lat,
    lng: listing.lng,
    sizeM2: listing.sizeM2,
    rooms: listing.rooms,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    maxGuests: listing.maxGuests,
    petsAllowed: listing.petsAllowed,
    facilities: listing.facilities,
    extraAmenities: listing.extraAmenities,
    characteristics: listing.characteristics,
    termsOfRent: listing.termsOfRent,
    depositMonths: listing.depositMonths,
    discountPercent: listing.discountPercent,
    laundryPricePerKg: listing.laundryPricePerKg,
    availableFrom: day(listing.availableFrom),
    availableUntil: day(listing.availableUntil),
    workingDays: listing.workingDays,
    guestIdPolicy: listing.guestIdPolicy,
    rates: listing.rates.map(({ unit, price, minUnits, maxUnits, checkInTime, checkOutTime, dayStartTime, dayEndTime }) => ({
      unit,
      price,
      minUnits,
      maxUnits,
      checkInTime,
      checkOutTime,
      dayStartTime,
      dayEndTime,
    })),
  };
}

const shown = (v: unknown): string =>
  v === null || v === undefined
    ? ""
    : Array.isArray(v)
      ? v.map((x) => (x && typeof x === "object" && "unit" in x ? `${(x as { unit: string }).unit}: ${(x as { price?: number }).price ?? ""}` : shown(x))).join(", ")
      : typeof v === "object"
        ? JSON.stringify(v)
        : String(v);

/** What an owner changed on a place: each field that differs, before and after (as short text, for staff). */
export function listingChanges(before: ListingInput, after: ListingInput): { key: string; before: string; after: string }[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])] as (keyof ListingInput)[];
  return keys.flatMap((key) => {
    const a = shown(before[key]);
    const b = shown(after[key]);
    return a === b ? [] : [{ key, before: a, after: b }];
  });
}
