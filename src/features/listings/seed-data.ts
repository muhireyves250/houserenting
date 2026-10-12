// Demo listings for development and staging. Photos are Unsplash (free license).
type Unit = "HOUR" | "DAY" | "NIGHT" | "MONTH";
type Facility =
  | "KITCHEN"
  | "WIFI"
  | "AIR_CONDITIONER"
  | "WORKPLACE"
  | "WASHING_MACHINE"
  | "DISHWASHER"
  | "OVEN"
  | "MICROWAVE"
  | "PARKING"
  | "TV"
  | "HOT_WATER"
  | "SECURITY"
  | "GENERATOR"
  | "POOL";

export type SeedRate = {
  unit: Unit;
  price: number;
  minUnits?: number;
  maxUnits?: number;
  checkInTime?: string;
  checkOutTime?: string;
  dayStartTime?: string;
  dayEndTime?: string;
};

export type SeedListing = {
  id: string;
  title: string;
  description: string;
  type: "APARTMENT" | "DUPLEX" | "PRIVATE_HOUSE" | "LODGE" | "ROOM";
  addressLine: string;
  district: string;
  city: string;
  lat: number;
  lng: number;
  sizeM2: number;
  rooms: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  petsAllowed?: boolean;
  facilities: Facility[];
  characteristics: string[];
  termsOfRent: string[];
  depositMonths?: number;
  discountPercent?: number;
  ratingAvg?: number;
  ratingCount?: number;
  daysSincePublished: number;
  photos: string[];
  rates: SeedRate[];
};

const photo = (id: string) => `https://images.unsplash.com/photo-${id}`;

const P = {
  apartment1: photo("1502672260266-1c1ef2d93688"),
  living1: photo("1522708323590-d24dbb6b0267"),
  apartment2: photo("1560448204-e02f11c3d0e2"),
  living2: photo("1493809842364-78817add7ffb"),
  kitchen1: photo("1484154218962-a197022b5858"),
  bedroom1: photo("1505691938895-1758d7feb511"),
  house1: photo("1512917774080-9991f1c4c750"),
  house2: photo("1568605114967-8130f3a36994"),
  modern1: photo("1600585154340-be6161a56a0c"),
  modern2: photo("1600596542815-ffad4c1539a9"),
  house3: photo("1564013799919-ab600027ffc6"),
  house4: photo("1570129477492-45c003edd2be"),
  interior1: photo("1586023492125-27b2c045efd7"),
  bedroom2: photo("1615874959474-d609969a20ed"),
  bedroom3: photo("1631049307264-da0ec9d70304"),
  kitchen2: photo("1600210492486-724fe5c67fb0"),
  kitchen3: photo("1556909114-f6e7ad7d3136"),
  house5: photo("1501183638710-841dd1904471"),
  cabin1: photo("1449844908441-8829872d2607"),
  cottage1: photo("1518780664697-55e3ad937233"),
  living3: photo("1513694203232-719a280e022f"),
  studio1: photo("1554995207-c18c203602cb"),
  bedroom4: photo("1595526114035-0d45ed16cfbf"),
  modern3: photo("1600607687939-ce8a6c25118c"),
};

const NIGHT = { checkInTime: "14:00", checkOutTime: "11:00" };
const DAY = { dayStartTime: "08:00", dayEndTime: "20:00" };

export const SEED_LISTINGS: SeedListing[] = [
  {
    id: "seed-kimihurura-flat",
    title: "Bright 2-bedroom flat in Kimihurura",
    description:
      "A calm, sunny apartment a short walk from Kigali's best cafés and restaurants. Fast Wi-Fi and a dedicated desk make it ideal for remote work.",
    type: "APARTMENT",
    addressLine: "KG 9 Ave",
    district: "Gasabo",
    city: "Kigali",
    lat: -1.952,
    lng: 30.087,
    sizeM2: 95,
    rooms: 4,
    bedrooms: 2,
    bathrooms: 2,
    maxGuests: 4,
    facilities: ["KITCHEN", "WIFI", "WORKPLACE", "WASHING_MACHINE", "HOT_WATER", "SECURITY", "PARKING"],
    characteristics: ["95 m² total", "Balcony with city view", "Built-in wardrobes", "Equipped kitchen"],
    termsOfRent: ["No smoking", "No parties", "Quiet hours after 22:00"],
    discountPercent: 15,
    ratingAvg: 4.7,
    ratingCount: 38,
    daysSincePublished: 3,
    photos: [P.apartment1, P.living1, P.kitchen1, P.bedroom1],
    rates: [
      { unit: "NIGHT", price: 65000, minUnits: 1, maxUnits: 30, ...NIGHT },
      { unit: "DAY", price: 40000, ...DAY },
    ],
  },
  {
    id: "seed-nyarutarama-villa",
    title: "Family villa with garden in Nyarutarama",
    description:
      "Spacious 4-bedroom villa with a private garden, close to the golf course and international schools. Perfect for families relocating to Kigali.",
    type: "PRIVATE_HOUSE",
    addressLine: "KG 13 Ave",
    district: "Gasabo",
    city: "Kigali",
    lat: -1.938,
    lng: 30.104,
    sizeM2: 320,
    rooms: 7,
    bedrooms: 4,
    bathrooms: 3,
    maxGuests: 8,
    petsAllowed: true,
    facilities: ["KITCHEN", "WIFI", "PARKING", "SECURITY", "GENERATOR", "HOT_WATER", "WASHING_MACHINE", "OVEN"],
    characteristics: ["320 m² total", "Private garden", "Staff quarters", "Orientation south"],
    termsOfRent: ["Payment for the first and last month", "2 months deposit", "Without guarantor"],
    depositMonths: 2,
    ratingAvg: 4.9,
    ratingCount: 12,
    daysSincePublished: 20,
    photos: [P.house1, P.living2, P.kitchen2, P.bedroom2],
    rates: [{ unit: "MONTH", price: 2500000, minUnits: 6 }],
  },
  {
    id: "seed-kacyiru-studio",
    title: "Modern studio near Kigali Convention Centre",
    description: "Compact studio for business travellers. Book by the hour for meetings, or stay the night.",
    type: "ROOM",
    addressLine: "KG 7 Ave",
    district: "Gasabo",
    city: "Kigali",
    lat: -1.94,
    lng: 30.075,
    sizeM2: 32,
    rooms: 1,
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    facilities: ["WIFI", "AIR_CONDITIONER", "WORKPLACE", "TV", "HOT_WATER", "SECURITY"],
    characteristics: ["32 m² total", "Work desk", "Smart TV"],
    termsOfRent: ["No smoking", "ID required at check-in"],
    discountPercent: 50,
    ratingAvg: 4.5,
    ratingCount: 176,
    daysSincePublished: 2,
    photos: [P.studio1, P.bedroom3, P.interior1],
    rates: [
      { unit: "HOUR", price: 9000, minUnits: 2, maxUnits: 8, dayStartTime: "07:00", dayEndTime: "22:00" },
      { unit: "NIGHT", price: 45000, ...NIGHT },
    ],
  },
  {
    id: "seed-kicukiro-duplex",
    title: "Duplex with rooftop terrace in Kicukiro",
    description: "Two floors, three bedrooms and a rooftop terrace with sunset views over Kigali.",
    type: "DUPLEX",
    addressLine: "KK 15 Rd",
    district: "Kicukiro",
    city: "Kigali",
    lat: -1.985,
    lng: 30.103,
    sizeM2: 180,
    rooms: 6,
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    facilities: ["KITCHEN", "WIFI", "PARKING", "WASHING_MACHINE", "DISHWASHER", "OVEN", "MICROWAVE", "HOT_WATER"],
    characteristics: ["180 m² total", "Rooftop terrace", "Secondary housing / good condition", "Individual heating: natural gas"],
    termsOfRent: ["Without animals", "Payment for the first and last month", "1 month deposit"],
    depositMonths: 1,
    ratingAvg: 4.4,
    ratingCount: 21,
    daysSincePublished: 35,
    photos: [P.modern1, P.living3, P.kitchen3, P.bedroom4],
    rates: [
      { unit: "MONTH", price: 1200000, minUnits: 6 },
      { unit: "NIGHT", price: 110000, minUnits: 2, ...NIGHT },
    ],
  },
  {
    id: "seed-remera-apartment",
    title: "Furnished apartment by Amahoro Stadium",
    description: "Comfortable 1-bedroom apartment in Remera, minutes from the stadium and the airport road.",
    type: "APARTMENT",
    addressLine: "KG 17 Ave",
    district: "Gasabo",
    city: "Kigali",
    lat: -1.957,
    lng: 30.113,
    sizeM2: 60,
    rooms: 3,
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    facilities: ["KITCHEN", "WIFI", "TV", "HOT_WATER", "SECURITY"],
    characteristics: ["60 m² total", "Fully furnished", "Equipped kitchen"],
    termsOfRent: ["Without animals", "2 months deposit"],
    depositMonths: 2,
    ratingAvg: 4.2,
    ratingCount: 9,
    daysSincePublished: 50,
    photos: [P.apartment2, P.kitchen1, P.bedroom1],
    rates: [{ unit: "MONTH", price: 650000, minUnits: 6 }],
  },
  {
    id: "seed-kinigi-lodge",
    title: "Volcano-view lodge in Kinigi",
    description:
      "A cosy stone lodge at the foot of the Virunga volcanoes — the perfect base for gorilla trekking in Volcanoes National Park.",
    type: "LODGE",
    addressLine: "Kinigi Road",
    district: "Musanze",
    city: "Musanze",
    lat: -1.43,
    lng: 29.59,
    sizeM2: 70,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    facilities: ["WIFI", "HOT_WATER", "PARKING", "GENERATOR", "SECURITY"],
    characteristics: ["Fireplace", "Mountain view", "Breakfast available"],
    termsOfRent: ["Check-in from 14:00", "Quiet hours after 21:00"],
    ratingAvg: 4.9,
    ratingCount: 64,
    daysSincePublished: 7,
    photos: [P.cabin1, P.cottage1, P.bedroom2],
    rates: [{ unit: "NIGHT", price: 120000, minUnits: 2, maxUnits: 14, ...NIGHT }],
  },
  {
    id: "seed-musanze-house",
    title: "Quiet family house in Musanze town",
    description: "Three-bedroom house with a garden, close to the market and schools. Long-term only.",
    type: "PRIVATE_HOUSE",
    addressLine: "NM 6 St",
    district: "Musanze",
    city: "Musanze",
    lat: -1.499,
    lng: 29.635,
    sizeM2: 150,
    rooms: 5,
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    petsAllowed: true,
    facilities: ["KITCHEN", "PARKING", "HOT_WATER", "WASHING_MACHINE"],
    characteristics: ["150 m² total", "Garden", "Water tank"],
    termsOfRent: ["Payment for the first month", "1 month deposit"],
    depositMonths: 1,
    daysSincePublished: 4,
    photos: [P.house2, P.living2, P.kitchen2],
    rates: [{ unit: "MONTH", price: 450000, minUnits: 6 }],
  },
  {
    id: "seed-rubavu-lakehouse",
    title: "Lake Kivu beach house in Gisenyi",
    description: "Wake up to Lake Kivu. Private beach access, a large terrace and space for the whole group.",
    type: "PRIVATE_HOUSE",
    addressLine: "Avenue de la Production",
    district: "Rubavu",
    city: "Rubavu",
    lat: -1.703,
    lng: 29.257,
    sizeM2: 210,
    rooms: 6,
    bedrooms: 4,
    bathrooms: 3,
    maxGuests: 10,
    facilities: ["KITCHEN", "WIFI", "PARKING", "HOT_WATER", "SECURITY", "GENERATOR", "TV"],
    characteristics: ["Private beach access", "Large terrace", "BBQ area"],
    termsOfRent: ["No parties", "Minimum 2 nights on weekends"],
    discountPercent: 10,
    ratingAvg: 4.8,
    ratingCount: 47,
    daysSincePublished: 12,
    photos: [P.house3, P.living3, P.kitchen3, P.bedroom3],
    rates: [
      { unit: "NIGHT", price: 180000, minUnits: 1, ...NIGHT },
      { unit: "DAY", price: 90000, ...DAY },
    ],
  },
  {
    id: "seed-rubavu-room",
    title: "Day-use room near Rubavu beach",
    description: "Freshen up between bus connections or enjoy a day at the lake. Hourly and day-use bookings.",
    type: "ROOM",
    addressLine: "RN 4",
    district: "Rubavu",
    city: "Rubavu",
    lat: -1.69,
    lng: 29.26,
    sizeM2: 20,
    rooms: 1,
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    facilities: ["WIFI", "HOT_WATER", "TV"],
    characteristics: ["Private shower", "Lake view"],
    termsOfRent: ["ID required at check-in"],
    ratingAvg: 4.1,
    ratingCount: 15,
    daysSincePublished: 1,
    photos: [P.bedroom4, P.interior1, P.studio1],
    rates: [
      { unit: "HOUR", price: 6000, minUnits: 1, maxUnits: 6, dayStartTime: "08:00", dayEndTime: "20:00" },
      { unit: "DAY", price: 25000, ...DAY },
    ],
  },
  {
    id: "seed-huye-apartment",
    title: "Student-friendly apartment near University of Rwanda, Huye",
    description: "Two bedrooms, a study corner and reliable Wi-Fi, a 5-minute walk from campus.",
    type: "APARTMENT",
    addressLine: "Huye Main Road",
    district: "Huye",
    city: "Huye",
    lat: -2.597,
    lng: 29.739,
    sizeM2: 70,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 3,
    facilities: ["KITCHEN", "WIFI", "WORKPLACE", "HOT_WATER"],
    characteristics: ["70 m² total", "Study corner"],
    termsOfRent: ["Without animals", "1 month deposit", "Without guarantor"],
    depositMonths: 1,
    ratingAvg: 4.3,
    ratingCount: 8,
    daysSincePublished: 60,
    photos: [P.apartment1, P.studio1, P.kitchen1],
    rates: [{ unit: "MONTH", price: 280000, minUnits: 6 }],
  },
  {
    id: "seed-karongi-cottage",
    title: "Lakeside cottage in Karongi (Kibuye)",
    description: "Peaceful cottage among the hills of Lake Kivu. Kayaks available for guests.",
    type: "LODGE",
    addressLine: "Kibuye Lakeside",
    district: "Karongi",
    city: "Karongi",
    lat: -2.06,
    lng: 29.348,
    sizeM2: 55,
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 3,
    facilities: ["WIFI", "HOT_WATER", "PARKING"],
    characteristics: ["Lake view", "Kayaks for guests"],
    termsOfRent: ["Check-in from 14:00", "No smoking indoors"],
    discountPercent: 20,
    ratingAvg: 4.6,
    ratingCount: 29,
    daysSincePublished: 9,
    photos: [P.cottage1, P.cabin1, P.bedroom2],
    rates: [{ unit: "NIGHT", price: 75000, minUnits: 1, ...NIGHT }],
  },
  {
    id: "seed-rusizi-house",
    title: "Modern house in Kamembe, Rusizi",
    description: "New 3-bedroom house near the Congo border crossing, ideal for long-term stays.",
    type: "PRIVATE_HOUSE",
    addressLine: "Kamembe Road",
    district: "Rusizi",
    city: "Rusizi",
    lat: -2.48,
    lng: 28.9,
    sizeM2: 140,
    rooms: 5,
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 5,
    facilities: ["KITCHEN", "PARKING", "HOT_WATER", "SECURITY", "WIFI"],
    characteristics: ["140 m² total", "New build", "Fenced compound"],
    termsOfRent: ["Payment for the first and last month", "2 months deposit"],
    depositMonths: 2,
    daysSincePublished: 5,
    photos: [P.modern2, P.modern3, P.kitchen2],
    rates: [{ unit: "MONTH", price: 550000, minUnits: 6 }],
  },
];
