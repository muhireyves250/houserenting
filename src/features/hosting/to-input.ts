import type { HostListing } from "./service";
import type { ListingInput } from "./validation";

const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

/** A saved listing as the values the listing form edits. */
export function toListingInput(listing: HostListing): ListingInput {
  return {
    title: listing.title,
    description: listing.description,
    type: listing.type,
    bookingModel: listing.bookingModel,
    addressLine: listing.addressLine,
    district: listing.district,
    city: listing.city,
    lat: listing.lat,
    lng: listing.lng,
    sizeM2: listing.sizeM2,
    rooms: listing.rooms,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    maxGuests: listing.maxGuests,
    petsAllowed: listing.petsAllowed,
    facilities: listing.facilities,
    characteristics: listing.characteristics,
    termsOfRent: listing.termsOfRent,
    depositMonths: listing.depositMonths,
    discountPercent: listing.discountPercent,
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
