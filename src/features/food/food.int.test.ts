import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { addRestaurantMember, moveOrder, ordersLive, placeOrder, restaurantsNear, saveMenuItem, saveRestaurant, setRestaurantStatus } from "./service";

const admin = { id: "admin", role: "ADMIN" };
const base = {
  name: "Kivu Grill",
  description: "",
  phone: null,
  addressLine: "Lake road",
  district: "Rubavu",
  city: "Gisenyi",
  lat: -1.7,
  lng: 29.26,
  openingHours: "",
  photoUrl: null,
  pickup: true,
  delivery: true,
  deliveryFee: 1000,
  deliveryKm: 5,
  listingId: null,
};

async function liveRestaurant() {
  const saved = await saveRestaurant({ id: "owner" }, null, base);
  if (!saved.ok) throw new Error("save failed");
  await saveMenuItem({ id: "owner" }, saved.id, null, { name: "Brochette", price: 3000 });
  expect(await setRestaurantStatus(admin, saved.id, "PUBLISHED")).toBe(true);
  return saved.id;
}

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "owner", name: "Owner", email: "owner@example.com" },
      { id: "cook", name: "Cook", email: "cook@example.com" },
      { id: "rider", name: "Rider", email: "rider@example.com" },
      { id: "guest", name: "Guest", email: "guest@example.com" },
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" },
    ],
  });
  // Only property owners (and staff) add restaurants.
  await db.listing.create({
    data: { id: "place", hostId: "owner", title: "Lake house", description: "Nice", type: "PRIVATE_HOUSE", status: "PUBLISHED", addressLine: "KG 1", district: "Rubavu", city: "Gisenyi", lat: -1.7, lng: 29.26, sizeM2: 90, rooms: 3, bedrooms: 2, bathrooms: 1, maxGuests: 4 },
  });
});

describe("restaurants and orders", () => {
  it("clients who only book can't add a restaurant; property owners can", async () => {
    expect(await saveRestaurant({ id: "guest" }, null, base)).toEqual({ ok: false, error: "notAllowed" });
    expect((await saveRestaurant({ id: "owner" }, null, base)).ok).toBe(true);
  });

  it("refuses orders below the restaurant's minimum", async () => {
    const id = await liveRestaurant();
    await db.restaurant.update({ where: { id }, data: { minOrder: 10_000 } });
    const dish = await db.menuItem.findFirstOrThrow();
    expect(await placeOrder("guest", { restaurantId: id, lines: [{ menuItemId: dish.id, quantity: 1 }], fulfilment: "PICKUP", address: null, bookingReference: null, phone: "0788123456", note: null })).toEqual({ ok: false, error: "minOrder" });
  });

  it("only staff publish; hiding needs a reason; ORDERS appears once one is live", async () => {
    const saved = await saveRestaurant({ id: "owner" }, null, base);
    if (!saved.ok) throw new Error("save failed");
    expect(await ordersLive()).toBe(false);
    expect(await setRestaurantStatus({ id: "owner" }, saved.id, "PUBLISHED")).toBe(false);
    expect(await setRestaurantStatus(admin, saved.id, "PUBLISHED")).toBe(false); // no menu yet
    await saveMenuItem({ id: "owner" }, saved.id, null, { name: "Brochette", price: 3000 });
    expect(await setRestaurantStatus(admin, saved.id, "PUBLISHED")).toBe(true);
    expect(await ordersLive()).toBe(true);
    expect(await setRestaurantStatus(admin, saved.id, "HIDDEN")).toBe(false);
    expect(await setRestaurantStatus(admin, saved.id, "HIDDEN", "Health inspection")).toBe(true);
    expect(await restaurantsNear(null)).toEqual([]);
  });

  it("prices orders from the menu and walks a delivery through kitchen and courier", async () => {
    const id = await liveRestaurant();
    const dish = await db.menuItem.findFirstOrThrow();
    await addRestaurantMember({ id: "owner" }, id, "cook@example.com", "STAFF");
    await addRestaurantMember({ id: "owner" }, id, "rider@example.com", "DELIVERY");

    expect(await placeOrder("guest", { restaurantId: id, lines: [{ menuItemId: dish.id, quantity: 2 }], fulfilment: "DELIVERY", address: null, bookingReference: null, phone: "0788123456", note: null })).toEqual({ ok: false, error: "invalid" });
    const placed = await placeOrder("guest", { restaurantId: id, lines: [{ menuItemId: dish.id, quantity: 2 }], fulfilment: "DELIVERY", address: "KN 5 Rd, house 12", bookingReference: null, phone: "0788123456", note: "No onions" });
    if (!placed.ok) throw new Error("order failed");
    expect(await db.foodOrder.findUniqueOrThrow({ where: { reference: placed.reference } })).toMatchObject({ subtotal: 6000, deliveryFee: 1000, total: 7000 });

    expect(await moveOrder({ id: "rider" }, placed.reference, "ACCEPTED")).toBe(false);
    expect(await moveOrder({ id: "cook" }, placed.reference, "ACCEPTED")).toBe(true);
    expect(await moveOrder({ id: "guest" }, placed.reference, "CANCELLED")).toBe(false); // already accepted
    expect(await moveOrder({ id: "cook" }, placed.reference, "PREPARING")).toBe(true);
    expect(await moveOrder({ id: "cook" }, placed.reference, "READY")).toBe(true);
    expect(await moveOrder({ id: "rider" }, placed.reference, "OUT_FOR_DELIVERY")).toBe(true);
    expect(await moveOrder({ id: "rider" }, placed.reference, "DELIVERED")).toBe(true);
    expect(await db.orderEvent.count()).toBe(6);
    expect(await db.notification.count({ where: { userId: "guest", kind: "orderStatus" } })).toBe(5);
  });

  it("refuses orders when paused, and lets customers cancel before acceptance", async () => {
    const id = await liveRestaurant();
    const dish = await db.menuItem.findFirstOrThrow();
    const order = { restaurantId: id, lines: [{ menuItemId: dish.id, quantity: 1 }], fulfilment: "PICKUP" as const, address: null, bookingReference: null, phone: "0788123456", note: null };
    const placed = await placeOrder("guest", order);
    if (!placed.ok) throw new Error("order failed");
    expect(await moveOrder({ id: "guest" }, placed.reference, "CANCELLED")).toBe(true);
    await db.restaurant.update({ where: { id }, data: { paused: true } });
    expect(await placeOrder("guest", order)).toEqual({ ok: false, error: "closed" });
  });
});
