import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { addRestaurantMember, claimOrderPayment, confirmOrderPayment, hideMyOrder, myOrders, kitchenForPlace, moveOrder, ordersLive, placeOrder, saveMenuItem, saveRestaurant, setRestaurantStatus } from "./service";

const admin = { id: "admin", role: "ADMIN" };
const NOW = new Date("2026-11-03T08:00:00Z");
const base = {
  name: "Lake house kitchen",
  description: "",
  phone: null,
  addressLine: "Lake road",
  district: "Rubavu",
  city: "Gisenyi",
  lat: -1.7,
  lng: 29.26,
  openingHours: "",
  photoUrl: null,
  pickup: false,
  delivery: false,
  deliveryFee: 0,
  deliveryKm: 5,
  listingId: "place",
};

/** A kitchen VIIPA set up for the place, with one dish, live. */
async function liveKitchen() {
  const saved = await saveRestaurant(admin, null, base);
  if (!saved.ok) throw new Error("save failed");
  await saveMenuItem(admin, saved.id, null, { name: "Brochette", price: 3000 });
  expect(await setRestaurantStatus(admin, saved.id, "PUBLISHED")).toBe(true);
  return saved.id;
}

const order = (restaurantId: string, menuItemId: string, over: Record<string, unknown> = {}) =>
  placeOrder("guest", { restaurantId, lines: [{ menuItemId, quantity: 2 }], fulfilment: "TO_STAY", address: null, bookingReference: "SR-FOOD23", phone: "0788123456", note: null, ...over }, NOW);

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "owner", name: "Owner", email: "owner@example.com" },
      { id: "cook", name: "Cook", email: "cook@example.com" },
      { id: "guest", name: "Guest", email: "guest@example.com" },
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" },
    ],
  });
  for (const id of ["place", "elsewhere"]) {
    await db.listing.create({
      data: { id, hostId: "owner", title: id === "place" ? "Lake house" : "City flat", description: "Nice", type: "PRIVATE_HOUSE", status: "PUBLISHED", addressLine: "KG 1", district: "Rubavu", city: "Gisenyi", lat: -1.7, lng: 29.26, sizeM2: 90, rooms: 3, bedrooms: 2, bathrooms: 1, maxGuests: 4 },
    });
  }
  // The guest is staying at "place" right now.
  await db.booking.create({
    data: {
      reference: "SR-FOOD23", listingId: "place", guestId: "guest", status: "CHECKED_IN",
      checkIn: new Date("2026-11-02T00:00:00Z"), checkOut: new Date("2026-11-05T00:00:00Z"),
      startAt: new Date("2026-11-02T12:00:00Z"), endAt: new Date("2026-11-05T09:00:00Z"),
      nights: 3, guests: 2, nightlyPrice: 50_000, subtotal: 150_000, total: 150_000, hostPayout: 135_000, policySnapshot: {},
    },
  });
});

describe("food from the kitchen of the guest's stay", () => {
  it("only VIIPA sets up kitchens; publishing needs a dish; hiding needs a reason", async () => {
    expect(await saveRestaurant({ id: "owner" }, null, base)).toEqual({ ok: false, error: "notAllowed" });
    const saved = await saveRestaurant(admin, null, base);
    if (!saved.ok) throw new Error("save failed");
    expect(await ordersLive()).toBe(false);
    expect(await setRestaurantStatus(admin, saved.id, "PUBLISHED")).toBe(false); // no menu yet
    await saveMenuItem(admin, saved.id, null, { name: "Brochette", price: 3000 });
    expect(await setRestaurantStatus(admin, saved.id, "PUBLISHED")).toBe(true);
    expect((await kitchenForPlace("place"))?.id).toBe(saved.id);
    // A place without its own kitchen gets the nearest one.
    expect((await kitchenForPlace("elsewhere"))?.id).toBe(saved.id);
    expect(await setRestaurantStatus(admin, saved.id, "HIDDEN")).toBe(false);
    expect(await setRestaurantStatus(admin, saved.id, "HIDDEN", "Health inspection")).toBe(true);
  });

  it("brings orders to the guest's room only, from their own stay's kitchen", async () => {
    const id = await liveKitchen();
    const dish = await db.menuItem.findFirstOrThrow();
    expect(await order(id, dish.id, { fulfilment: "DELIVERY", address: "KN 5 Rd" })).toEqual({ ok: false, error: "notOffered" });
    expect(await order(id, dish.id, { bookingReference: null })).toEqual({ ok: false, error: "noStay" });
    // The stay's own kitchen cooks; another place's kitchen can't take the order.
    await db.restaurant.update({ where: { id }, data: { listingId: "elsewhere" } });
    const own = await db.restaurant.create({ data: { ...(await db.restaurant.findUniqueOrThrow({ where: { id }, omit: { id: true, createdAt: true, updatedAt: true } })), name: "Lake house kitchen", listingId: "place" } });
    await db.menuItem.create({ data: { restaurantId: own.id, name: "Fish", price: 5000 } });
    expect(await order(id, dish.id)).toEqual({ ok: false, error: "tooFar" });
    await db.restaurant.delete({ where: { id: own.id } });
    await db.restaurant.update({ where: { id }, data: { listingId: "place" } });

    const placed = await order(id, dish.id);
    if (!placed.ok) throw new Error("order failed");
    expect(await db.foodOrder.findUniqueOrThrow({ where: { reference: placed.reference } })).toMatchObject({ subtotal: 6000, deliveryFee: 0, total: 6000, fulfilment: "TO_STAY" });

    await addRestaurantMember(admin, id, "cook@example.com", "STAFF");
    expect(await moveOrder({ id: "guest" }, placed.reference, "ACCEPTED")).toBe(false);
    // Pay first: the kitchen can't start until VIIPA confirms the guest's mobile money payment.
    expect(await moveOrder({ id: "cook" }, placed.reference, "ACCEPTED")).toBe(false);
    expect(await claimOrderPayment("guest", placed.reference, "MP2611.FOOD.001")).toEqual({ ok: true });
    expect(await confirmOrderPayment({ id: "cook" }, placed.reference)).toEqual({ ok: false, error: "notAllowed" });
    expect(await confirmOrderPayment(admin, placed.reference)).toEqual({ ok: true });
    expect(await confirmOrderPayment(admin, placed.reference)).toEqual({ ok: false, error: "notFound" });
    const ledger = await db.ledgerEntry.findMany({ where: { note: `food ${placed.reference}` } });
    expect(ledger.find((e) => e.kind === "GUEST_PAYMENT")?.amount).toBe(6000);
    expect(ledger.reduce((sum, e) => sum + (e.kind === "COMMISSION" || e.kind === "HOST_PAYABLE" ? e.amount : 0), 0)).toBe(6000);
    for (const step of ["ACCEPTED", "PREPARING", "READY", "DELIVERED"] as const) expect(await moveOrder({ id: "cook" }, placed.reference, step)).toBe(true);
    expect(await db.notification.count({ where: { userId: "guest", kind: "orderStatus" } })).toBe(5); // paid + 4 steps
  });

  it("refuses orders when the kitchen is paused or below its minimum; guests cancel before acceptance", async () => {
    const id = await liveKitchen();
    const dish = await db.menuItem.findFirstOrThrow();
    const placed = await order(id, dish.id);
    if (!placed.ok) throw new Error("order failed");
    expect(await moveOrder({ id: "guest" }, placed.reference, "CANCELLED")).toBe(true);
    // A cancelled order can be removed from the guest's list (the kitchen still has it).
    expect(await hideMyOrder("someone", placed.reference)).toBe(false);
    expect(await hideMyOrder("guest", placed.reference)).toBe(true);
    expect((await myOrders("guest")).some((o) => o.reference === placed.reference)).toBe(false);
    await db.restaurant.update({ where: { id }, data: { minOrder: 10_000 } });
    expect(await order(id, dish.id)).toEqual({ ok: false, error: "minOrder" });
    await db.restaurant.update({ where: { id }, data: { paused: true } });
    expect(await order(id, dish.id)).toEqual({ ok: false, error: "closed" });
  });
});
