import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setAgreement } from "@/features/agreements/service";
import { resetDb } from "@/test/db";
import { addRestaurantMember, assignCourier, expireOrders, rateOrder, restaurantRole, claimOrderPayment, confirmOrderPayment, deleteFoodOrder, deleteRestaurant, hideMyOrder, myOrders, kitchenForPlace, moveOrder, ordersForHost, ordersLive, placeOrder, saveMenuItem, saveRestaurant, setRestaurantStatus } from "./service";

const admin = { id: "admin", role: "ADMIN" };
const NOW = new Date("2026-11-03T08:00:00Z");
const base = {
  name: "Lake house kitchen",
  description: "",
  phone: null,
  addressLine: "Lake road",
  district: "Rubavu",
  city: "Gisenyi",
  villageCode: "RW-V-05836",
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
  await setAgreement(admin, "RESTAURANT", saved.id, { percent: 10 });
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
    // Its commission agreement comes first.
    expect(await setRestaurantStatus(admin, saved.id, "PUBLISHED")).toBe(false);
    expect(await setAgreement(admin, "RESTAURANT", saved.id, { percent: 10 })).toEqual({ ok: true });
    expect(await setRestaurantStatus(admin, saved.id, "PUBLISHED")).toBe(true);
    expect((await kitchenForPlace("place"))?.id).toBe(saved.id);
    // A place without a kitchen assigned gets none (never the nearest one).
    expect(await kitchenForPlace("elsewhere")).toBeNull();
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
    await db.user.create({ data: { id: "rider", name: "Rider", email: "rider@example.com", phone: "0788555666" } });
    await addRestaurantMember(admin, id, "rider@example.com", "DELIVERY");
    const ref = placed.reference;
    // The restaurant confirms first; the guest can't pay before that.
    expect(await claimOrderPayment("guest", ref, "MP2611.FOOD.001")).toEqual({ ok: false, error: "notFound" });
    expect(await moveOrder({ id: "guest" }, ref, "ACCEPTED")).toBe(false);
    expect(await moveOrder({ id: "cook" }, ref, "REJECTED")).toBe(false); // a reason is needed
    expect(await moveOrder({ id: "cook" }, ref, "ACCEPTED")).toBe(true);
    // Confirmed, not paid: the kitchen waits.
    expect(await moveOrder({ id: "cook" }, ref, "PREPARING")).toBe(false);
    expect(await claimOrderPayment("guest", ref, "MP2611.FOOD.001")).toEqual({ ok: true });
    expect(await confirmOrderPayment({ id: "cook" }, ref)).toEqual({ ok: false, error: "notAllowed" });
    expect(await confirmOrderPayment(admin, ref)).toEqual({ ok: true });
    expect(await confirmOrderPayment(admin, ref)).toEqual({ ok: false, error: "notFound" });
    const ledger = await db.ledgerEntry.findMany({ where: { note: `food ${ref}` } });
    expect(ledger.find((e) => e.kind === "GUEST_PAYMENT")?.amount).toBe(6000);
    expect(ledger.reduce((sum, e) => sum + (e.kind === "COMMISSION" || e.kind === "HOST_PAYABLE" ? e.amount : 0), 0)).toBe(6000);
    expect((await db.foodOrder.findUniqueOrThrow({ where: { reference: ref } })).status).toBe("PAID");
    expect(await db.notification.count({ where: { userId: "admin", kind: "orderNew" } })).toBe(1);
    // Prepared, then handed to the restaurant's delivery person.
    expect(await moveOrder({ id: "cook" }, ref, "PREPARING")).toBe(true);
    expect(await moveOrder({ id: "cook" }, ref, "READY")).toBe(true);
    expect(await assignCourier({ id: "cook" }, ref, "guest")).toBe(false); // not a delivery person
    expect(await assignCourier({ id: "cook" }, ref, "rider")).toBe(true);
    expect(await moveOrder({ id: "guest" }, ref, "OUT_FOR_DELIVERY")).toBe(false);
    expect(await moveOrder({ id: "rider" }, ref, "OUT_FOR_DELIVERY")).toBe(true);
    expect(await db.notification.findFirst({ where: { userId: "owner", kind: "orderSentToStay" }, select: { data: true } })).toMatchObject({ data: { reference: ref, name: "Guest", where: "Lake house" } });
    const seen = await ordersForHost("owner", NOW);
    expect(seen.map((o) => [o.reference, o.status, o.stay.reference])).toEqual([[ref, "OUT_FOR_DELIVERY", "SR-FOOD23"]]);
    // A failed delivery needs a reason; the order goes back to ready for another delivery person.
    expect(await moveOrder({ id: "rider" }, ref, "READY")).toBe(false);
    expect(await moveOrder({ id: "rider" }, ref, "READY", "Nobody at the gate")).toBe(true);
    expect(await assignCourier({ id: "cook" }, ref, "rider")).toBe(true);
    expect(await moveOrder({ id: "rider" }, ref, "OUT_FOR_DELIVERY")).toBe(true);
    // The guest says they got it; staff are told. Then their feedback finishes the order.
    expect(await moveOrder({ id: "guest" }, ref, "DELIVERED")).toBe(true);
    expect(await db.notification.count({ where: { userId: "admin", kind: "orderReceived" } })).toBe(1);
    expect(await rateOrder("guest", ref, 6, "")).toBe(false);
    expect(await rateOrder("guest", ref, 5, "Hot and fast")).toBe(true);
    expect(await db.foodOrder.findUniqueOrThrow({ where: { reference: ref } })).toMatchObject({ status: "FINISHED", rating: 5, feedback: "Hot and fast" });
    // Every step is kept with its time.
    expect((await db.orderEvent.findMany({ where: { order: { reference: ref } }, orderBy: { createdAt: "asc" } })).map((e) => e.to)).toEqual(["PLACED", "ACCEPTED", "PAID", "PREPARING", "READY", "COURIER_ASSIGNED", "OUT_FOR_DELIVERY", "READY", "COURIER_ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "FINISHED"]);
  }, 180_000);

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
    // Staff can delete a cancelled, unpaid order (never someone else; never a restaurant that has orders).
    expect(await deleteRestaurant(admin, id)).toEqual({ ok: false, error: "hasOrders" });
    expect(await deleteFoodOrder({ id: "guest" }, placed.reference)).toBe(false);
    expect(await deleteFoodOrder(admin, placed.reference)).toBe(true);
    expect(await deleteRestaurant({ id: "owner" }, id)).toEqual({ ok: false, error: "notAllowed" });
    await db.restaurant.update({ where: { id }, data: { minOrder: 10_000 } });
    expect(await order(id, dish.id)).toEqual({ ok: false, error: "minOrder" });
    await db.restaurant.update({ where: { id }, data: { paused: true } });
    expect(await order(id, dish.id)).toEqual({ ok: false, error: "closed" });
    // With no orders left, the restaurant (and its menu) can be deleted.
    expect(await deleteRestaurant(admin, id)).toEqual({ ok: true });
    expect(await db.menuItem.count({ where: { restaurantId: id } })).toBe(0);
  });

  it("VIIPA sets who works at a restaurant (not the owner)", async () => {
    await db.user.update({ where: { id: "owner" }, data: { isRestaurateur: true } });
    const saved = await saveRestaurant(admin, null, { ...base, listingId: "place" }, "owner");
    if (!saved.ok) throw new Error("save failed");
    expect(await addRestaurantMember({ id: "owner" }, saved.id, "cook@example.com", "STAFF")).toEqual({ ok: false, error: "notAllowed" });
    expect(await addRestaurantMember(admin, saved.id, "cook@example.com", "STAFF")).toEqual({ ok: true });
    expect(await restaurantRole({ id: "cook" }, saved.id)).toBe("kitchen");
    expect(await db.notification.count({ where: { userId: "owner", kind: "teamMemberJoined" } })).toBe(1);
  });

  it("a restaurant that doesn't answer within 5 minutes: the order times out, nothing is charged, everyone is told", async () => {
    const id = await liveKitchen();
    const dish = await db.menuItem.findFirstOrThrow();
    const placed = await order(id, dish.id);
    if (!placed.ok) throw new Error("order failed");
    expect(await expireOrders()).toBe(0); // still within 5 minutes
    await db.foodOrder.update({ where: { reference: placed.reference }, data: { createdAt: new Date(Date.now() - 6 * 60_000) } });
    expect(await expireOrders()).toBe(1);
    expect(await db.foodOrder.findUniqueOrThrow({ where: { reference: placed.reference } })).toMatchObject({ status: "TIMED_OUT", paidAt: null });
    expect((await db.menuItem.findUniqueOrThrow({ where: { id: dish.id } })).available).toBe(false);
    expect(await db.notification.count({ where: { userId: "admin", kind: "orderTimedOut" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: "guest", kind: "orderStatus" } })).toBe(1);
    // Too late to accept now.
    expect(await moveOrder(admin, placed.reference, "ACCEPTED")).toBe(false);
  });

  it("restaurants are added by people with the restaurant role (VIIPA checks them) or by VIIPA for them", async () => {
    const { setRestaurateur } = await import("@/features/admin/service");
    // Without the role: no restaurant, and staff can't make them its owner.
    expect(await saveRestaurant({ id: "owner" }, null, base)).toEqual({ ok: false, error: "notAllowed" });
    expect(await saveRestaurant(admin, null, base, "owner")).toEqual({ ok: false, errors: { ownerEmail: "notRestaurateur" } });
    expect(await setRestaurateur({ id: "owner" }, "owner", true)).toEqual({ ok: false, error: "notAllowed" });
    expect(await setRestaurateur(admin, "owner", true)).toEqual({ ok: true });
    expect(await db.notification.count({ where: { userId: "owner", kind: "restaurantRoleGiven" } })).toBe(1);
    // With it: they set it up themselves (a draft VIIPA is told about), or staff do it for them.
    const own = await saveRestaurant({ id: "owner" }, null, { ...base, name: "Owner's kitchen" });
    if (!own.ok) throw new Error("save failed");
    expect((await db.restaurant.findUniqueOrThrow({ where: { id: own.id } })).status).toBe("DRAFT");
    expect(await db.notification.count({ where: { userId: "admin", kind: "restaurantNew" } })).toBe(1);
    expect((await saveRestaurant(admin, null, { ...base, name: "Set up by VIIPA" }, "owner")).ok).toBe(true);
    // Not taken away while they own restaurants.
    expect(await setRestaurateur(admin, "owner", false)).toEqual({ ok: false, error: "hasRestaurants" });
  });
});
