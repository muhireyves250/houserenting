/** Demo restaurants (development, tests and the demo site). Prices in RWF. */
export type SeedDish = { section: string; name: string; description?: string; price: number };
export type SeedRestaurant = {
  id: string;
  name: string;
  description: string;
  /** Inside a demo place (its guests can order to their room), or on its own. */
  listingId: string | null;
  phone: string;
  addressLine: string;
  district: string;
  city: string;
  lat: number;
  lng: number;
  openingHours: string;
  photoUrl: string;
  pickup: boolean;
  delivery: boolean;
  deliveryFee: number;
  deliveryKm: number;
  menu: SeedDish[];
};

const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

export const SEED_RESTAURANTS: SeedRestaurant[] = [
  {
    id: "seed-rest-kimihurura",
    name: "Inzozi Café",
    description: "Rwandan coffee, fresh juices and all-day breakfast in Kimihurura.",
    listingId: "seed-kimihurura-flat",
    phone: "0788 100 201",
    addressLine: "KG 9 Ave",
    district: "Gasabo",
    city: "Kigali",
    lat: -1.9522,
    lng: 30.0872,
    openingHours: "Every day 06:30–22:00",
    photoUrl: photo("photo-1554118811-1e0d58224f24"),
    pickup: true,
    delivery: true,
    deliveryFee: 1000,
    deliveryKm: 5,
    menu: [
      { section: "Breakfast", name: "Rwandan breakfast", description: "Eggs, chapati, fried plantain, fruit and tea", price: 6000 },
      { section: "Breakfast", name: "Rolex", description: "Chapati rolled with a vegetable omelette", price: 2500 },
      { section: "Breakfast", name: "Pancakes with honey", price: 4500 },
      { section: "Lunch", name: "Beef brochettes", description: "Two skewers with fries or plantain", price: 5000 },
      { section: "Lunch", name: "Chicken wrap", description: "Grilled chicken, avocado, salad", price: 5500 },
      { section: "Drinks", name: "Rwandan coffee", description: "Single origin, Huye mountain", price: 2000 },
      { section: "Drinks", name: "Passion fruit juice", price: 2000 },
      { section: "Drinks", name: "African tea", description: "Spiced milk tea", price: 1500 },
    ],
  },
  {
    id: "seed-rest-remera",
    name: "Remera Grill House",
    description: "Brochettes, grilled tilapia and goat from the charcoal grill.",
    listingId: null,
    phone: "0788 100 202",
    addressLine: "KG 11 Ave, near Amahoro stadium",
    district: "Gasabo",
    city: "Kigali",
    lat: -1.9565,
    lng: 30.1148,
    openingHours: "Mon–Sun 11:00–23:30",
    photoUrl: photo("photo-1555939594-58d7cb561ad1"),
    pickup: true,
    delivery: true,
    deliveryFee: 1500,
    deliveryKm: 8,
    menu: [
      { section: "Grill", name: "Goat brochettes", description: "Three skewers with chips", price: 6000 },
      { section: "Grill", name: "Whole grilled tilapia", description: "With plantain and kachumbari", price: 12000 },
      { section: "Grill", name: "Half chicken", description: "Grilled with peri-peri", price: 9000 },
      { section: "Sides", name: "Fried plantain (ibitoki)", price: 2000 },
      { section: "Sides", name: "Chips", price: 2000 },
      { section: "Sides", name: "Kachumbari salad", price: 1500 },
      { section: "Drinks", name: "Soda", price: 1000 },
      { section: "Drinks", name: "Mineral water 500 ml", price: 800 },
    ],
  },
  {
    id: "seed-rest-kicukiro",
    name: "Mama Gaspard Kitchen",
    description: "Home-style Rwandan buffet plates: isombe, beans, matoke and rice.",
    listingId: null,
    phone: "0788 100 203",
    addressLine: "KK 15 Rd, Kicukiro centre",
    district: "Kicukiro",
    city: "Kigali",
    lat: -1.9862,
    lng: 30.1018,
    openingHours: "Mon–Sat 07:00–21:00",
    photoUrl: photo("photo-1512058564366-18510be2db19"),
    pickup: true,
    delivery: true,
    deliveryFee: 1000,
    deliveryKm: 6,
    menu: [
      { section: "Plates", name: "Rwandan buffet plate", description: "Isombe, beans, rice, matoke and a piece of beef", price: 4000 },
      { section: "Plates", name: "Isombe with ugali", description: "Cassava leaves cooked with peanut", price: 3000 },
      { section: "Plates", name: "Beans and rice", price: 2500 },
      { section: "Plates", name: "Sambaza", description: "Fried lake Kivu sardines with ugali", price: 4500 },
      { section: "Drinks", name: "Ikivuguto", description: "Fermented milk", price: 1500 },
      { section: "Drinks", name: "Fresh tree tomato juice", price: 1500 },
    ],
  },
  {
    id: "seed-rest-kinigi",
    name: "Volcano View Restaurant",
    description: "Hearty meals after the gorilla trek, at the Kinigi lodge.",
    listingId: "seed-kinigi-lodge",
    phone: "0788 100 204",
    addressLine: "Kinigi, near the park office",
    district: "Musanze",
    city: "Musanze",
    lat: -1.4302,
    lng: 29.5903,
    openingHours: "Every day 06:00–22:00",
    photoUrl: photo("photo-1414235077428-338989a2e8c0"),
    pickup: true,
    delivery: false,
    deliveryFee: 0,
    deliveryKm: 3,
    menu: [
      { section: "Breakfast", name: "Trekkers' breakfast", description: "Eggs, sausages, toast, fruit, coffee", price: 8000 },
      { section: "Packed lunch", name: "Trek lunch box", description: "Sandwich, fruit, juice and snacks", price: 7000 },
      { section: "Dinner", name: "Irish potato stew", description: "Musanze potatoes with beef", price: 6500 },
      { section: "Dinner", name: "Vegetable curry with rice", price: 6000 },
      { section: "Drinks", name: "Hot chocolate", price: 2500 },
      { section: "Drinks", name: "Ginger tea", price: 1500 },
    ],
  },
  {
    id: "seed-rest-rubavu",
    name: "Lake Kivu Fish Corner",
    description: "Fresh fish from Lake Kivu by the beach in Gisenyi.",
    listingId: "seed-rubavu-lakehouse",
    phone: "0788 100 205",
    addressLine: "Beach road, Gisenyi",
    district: "Rubavu",
    city: "Rubavu",
    lat: -1.7028,
    lng: 29.2568,
    openingHours: "Every day 10:00–23:00",
    photoUrl: photo("photo-1504674900247-0877df9cc836"),
    pickup: true,
    delivery: true,
    deliveryFee: 1000,
    deliveryKm: 5,
    menu: [
      { section: "Fish", name: "Grilled tilapia", description: "Whole fish with chips or plantain", price: 11000 },
      { section: "Fish", name: "Sambaza basket", description: "Crispy Kivu sardines with lemon", price: 5000 },
      { section: "Fish", name: "Fish brochettes", description: "Two skewers", price: 6000 },
      { section: "Sides", name: "Plantain", price: 2000 },
      { section: "Sides", name: "Avocado salad", price: 2500 },
      { section: "Drinks", name: "Fresh pineapple juice", price: 2000 },
      { section: "Drinks", name: "Soda", price: 1000 },
    ],
  },
  {
    id: "seed-rest-huye",
    name: "Huye Campus Bites",
    description: "Quick, affordable meals and Huye coffee near the university.",
    listingId: null,
    phone: "0788 100 206",
    addressLine: "University avenue",
    district: "Huye",
    city: "Huye",
    lat: -2.5969,
    lng: 29.7388,
    openingHours: "Mon–Sat 07:00–22:00",
    photoUrl: photo("photo-1565299624946-b28f40a0ae38"),
    pickup: true,
    delivery: true,
    deliveryFee: 800,
    deliveryKm: 4,
    menu: [
      { section: "Meals", name: "Chicken and chips", price: 4500 },
      { section: "Meals", name: "Beef pilau", description: "Spiced rice with beef", price: 3500 },
      { section: "Meals", name: "Veggie samosas (3)", price: 1500 },
      { section: "Meals", name: "Margherita pizza", price: 7000 },
      { section: "Drinks", name: "Huye coffee", price: 1500 },
      { section: "Drinks", name: "Milkshake", price: 3000 },
    ],
  },
];
