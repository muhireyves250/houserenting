import type { ListingInput } from "./validation";

/** A complete, valid listing for tests. */
export const validListing: ListingInput = {
  title: "Sunny studio in Kimihurura",
  description: "A bright studio close to the city centre, quiet street, fast Wi-Fi.",
  type: "APARTMENT",
  addressLine: "KG 7 Ave",
  district: "Gasabo",
  city: "Kigali",
  lat: -1.95,
  lng: 30.09,
  sizeM2: 40,
  rooms: 2,
  bedrooms: 1,
  bathrooms: 1,
  maxGuests: 2,
  petsAllowed: false,
  facilities: ["WIFI", "WIFI", "KITCHEN"],
  characteristics: ["Balcony", ""],
  termsOfRent: ["No smoking"],
  depositMonths: null,
  discountPercent: null,
  rates: [{ unit: "NIGHT", price: 45000, minUnits: 1, maxUnits: 30, checkInTime: "14:00", checkOutTime: "11:00" }],
};
