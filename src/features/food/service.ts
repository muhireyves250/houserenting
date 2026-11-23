import "server-only";
import { agreementAt, commissionUnder } from "@/features/agreements/service";
import { pathOfVillage } from "@/features/locations/rwanda";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/features/audit/service";
import { newReference } from "@/features/bookings/reference";
import { notify, notifyAdmins } from "@/features/notifications/service";
import { readSettings } from "@/features/settings/service";
import { todayISO } from "@/features/search/date-range";
import { db } from "@/lib/db";
import { canStaff } from "@/lib/roles";
import { ACCEPT_MINUTES, nextOrderSteps, priceCart, type OrderActor, type OrderStatus } from "./rules";
import { menuItemInput, orderInput, restaurantInput, type MenuItemInput, type OrderInput, type RestaurantInput } from "./validation";

type Actor = { id: string; role?: string | null };
export type RestaurantRole = "staff" | "owner" | "manager" | "kitchen" | "courier";
export type RestaurantAction = "edit" | "menu" | "team" | "orders" | "deliver" | "pause";

const ALLOWED: Record<RestaurantRole, readonly RestaurantAction[]> = {
  staff: ["edit", "menu", "team", "orders", "deliver", "pause"],
  // Who works at a restaurant is set by VIIPA staff only; the owner sees the team.
  owner: ["edit", "menu", "orders", "deliver", "pause"],
  manager: ["edit", "menu", "orders", "pause"],
  kitchen: ["orders"],
  courier: ["deliver"],
};

export const canRestaurant = (role: RestaurantRole | null, action: RestaurantAction) => role !== null && ALLOWED[role].includes(action);

export async function restaurantRole(actor: Actor, restaurantId: string): Promise<RestaurantRole | null> {
  if (canStaff(actor, "food")) return "staff";
  const r = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true, team: { where: { userId: actor.id, user: { status: "ACTIVE" } }, select: { role: true } } } });
  if (!r) return null;
  if (r.ownerId === actor.id) return "owner";
  const role = r.team[0]?.role;
  return role === "MANAGER" ? "manager" : role === "STAFF" ? "kitchen" : role === "DELIVERY" ? "courier" : null;
}

const errorsOf = (issues: { path: PropertyKey[]; message: string }[]) => {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[issue.path.join(".") || "form"] ??= issue.message;
  return errors;
};

export type SaveRestaurantResult = { ok: true; id: string } | { ok: false; errors: Record<string, string> } | { ok: false; error: "notAllowed" };

/**
 * Who may add a restaurant themselves: VIIPA staff, and property owners (someone with a place on the site).
 * Clients who only book can't; staff create restaurants for other owners from the dashboard.
 */
export async function canAddRestaurant(actor: Actor): Promise<boolean> {
  // Kitchens are set up by VIIPA for the places they serve.
  return canStaff(actor, "food");
}

/** Owners or staff create a restaurant (a draft until staff publish it); its owner, managers or staff edit it. */
export async function saveRestaurant(actor: Actor, id: string | null, raw: RestaurantInput, ownerId?: string): Promise<SaveRestaurantResult> {
  if (id === null && !(await canAddRestaurant(actor))) return { ok: false, error: "notAllowed" };
  const parsed = restaurantInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: errorsOf(parsed.error.issues) };
  // Only official locations: the names come from the village chosen, never from what was typed.
  const place = pathOfVillage(parsed.data.villageCode);
  if (!place) return { ok: false, errors: { villageCode: "location" } };
  const data = { ...parsed.data, ...place };
  if (data.listingId) {
    const listing = await db.listing.findUnique({ where: { id: data.listingId }, select: { hostId: true } });
    if (!listing || (!canStaff(actor, "food") && listing.hostId !== (ownerId ?? actor.id))) data.listingId = null;
  }
  if (id === null) {
    if (!(await canAddRestaurant(actor))) return { ok: false, error: "notAllowed" };
    const owner = canStaff(actor, "food") && ownerId ? ownerId : actor.id;
    const created = await db.restaurant.create({ data: { ...data, ownerId: owner } });
    await audit(db, { actorId: actor.id, action: "restaurant.create", entityType: "restaurant", entityId: created.id });
    return { ok: true, id: created.id };
  }
  if (!canRestaurant(await restaurantRole(actor, id), "edit")) return { ok: false, error: "notAllowed" };
  await db.restaurant.update({ where: { id }, data });
  await audit(db, { actorId: actor.id, action: "restaurant.update", entityType: "restaurant", entityId: id });
  return { ok: true, id };
}

/** Staff publish, hide (with a reason the owner sees) or show a restaurant again. */
export async function setRestaurantStatus(actor: Actor, id: string, status: "PUBLISHED" | "HIDDEN", reason = ""): Promise<boolean> {
  if (!canStaff(actor, "food")) return false;
  const why = reason.trim().slice(0, 500);
  if (status === "HIDDEN" && !why) return false;
  const r = await db.restaurant.findUnique({ where: { id }, select: { status: true, ownerId: true, name: true, _count: { select: { menu: true } } } });
  if (!r || r.status === status || (status === "PUBLISHED" && r._count.menu === 0)) return false;
  // VIIPA's commission is agreed per restaurant: no agreement, no going live.
  if (status === "PUBLISHED" && !(await db.commissionAgreement.findFirst({ where: { subject: "RESTAURANT", subjectId: id }, select: { id: true } }))) return false;
  await db.$transaction(async (tx) => {
    await tx.restaurant.update({ where: { id }, data: { status, statusReason: status === "HIDDEN" ? why : null } });
    await audit(tx, { actorId: actor.id, action: status === "HIDDEN" ? "restaurant.hide" : "restaurant.publish", entityType: "restaurant", entityId: id, data: { from: r.status, to: status, ...(why ? { reason: why } : {}) } });
    await notify(tx, r.ownerId, "restaurantStatus", { title: r.name, status, reason: why }, `/host/restaurants/${id}`);
  });
  return true;
}

export async function setRestaurantPaused(actor: Actor, id: string, paused: boolean): Promise<boolean> {
  if (!canRestaurant(await restaurantRole(actor, id), "pause")) return false;
  await db.restaurant.update({ where: { id }, data: { paused } });
  await audit(db, { actorId: actor.id, action: paused ? "restaurant.pause" : "restaurant.resume", entityType: "restaurant", entityId: id });
  return true;
}

export async function saveMenuItem(actor: Actor, restaurantId: string, itemId: string | null, raw: MenuItemInput): Promise<{ ok: true } | { ok: false; errors: Record<string, string> }> {
  if (!canRestaurant(await restaurantRole(actor, restaurantId), "menu")) return { ok: false, errors: { form: "notAllowed" } };
  const parsed = menuItemInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: errorsOf(parsed.error.issues) };
  if (itemId === null) {
    const count = await db.menuItem.count({ where: { restaurantId } });
    if (count >= 300) return { ok: false, errors: { form: "tooMany" } };
    await db.menuItem.create({ data: { ...parsed.data, restaurantId, position: count } });
  } else {
    const { count } = await db.menuItem.updateMany({ where: { id: itemId, restaurantId }, data: parsed.data });
    if (count !== 1) return { ok: false, errors: { form: "notFound" } };
  }
  return { ok: true };
}

export async function deleteMenuItem(actor: Actor, itemId: string): Promise<boolean> {
  const item = await db.menuItem.findUnique({ where: { id: itemId }, select: { restaurantId: true } });
  if (!item || !canRestaurant(await restaurantRole(actor, item.restaurantId), "menu")) return false;
  await db.menuItem.delete({ where: { id: itemId } });
  return true;
}

export const RESTAURANT_TEAM_ROLES = ["MANAGER", "STAFF", "DELIVERY"] as const;
export type RestaurantTeamRole = (typeof RESTAURANT_TEAM_ROLES)[number];

export async function addRestaurantMember(actor: Actor, restaurantId: string, email: string, role: RestaurantTeamRole): Promise<{ ok: true } | { ok: false; error: "notAllowed" | "noAccount" | "isOwner" | "invalid" }> {
  if (!RESTAURANT_TEAM_ROLES.includes(role) || typeof email !== "string" || email.length > 200) return { ok: false, error: "invalid" };
  if (!canRestaurant(await restaurantRole(actor, restaurantId), "team")) return { ok: false, error: "notAllowed" };
  const [user, r] = await Promise.all([
    db.user.findFirst({ where: { email: email.trim().toLowerCase(), status: "ACTIVE", role: "USER" }, select: { id: true, name: true, email: true } }),
    db.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true, name: true } }),
  ]);
  if (!user) return { ok: false, error: "noAccount" };
  if (!r || r.ownerId === user.id) return { ok: false, error: "isOwner" };
  await db.$transaction(async (tx) => {
    await tx.restaurantMember.upsert({ where: { restaurantId_userId: { restaurantId, userId: user.id } }, create: { restaurantId, userId: user.id, role, addedById: actor.id }, update: { role } });
    await audit(tx, { actorId: actor.id, action: "restaurant.team", entityType: "restaurant", entityId: restaurantId, data: { user: user.id, role } });
    await notify(tx, user.id, "restaurantTeamAdded", { title: r.name, roleLabel: role }, `/host/restaurants/${restaurantId}`);
    // Someone else (VIIPA staff, a manager) added them: the owner is told who joined their team.
    if (actor.id !== r.ownerId) await notify(tx, r.ownerId, "teamMemberJoined", { name: user.name, title: r.name, roleLabel: role }, `/host/restaurants/${restaurantId}`);
  });
  return { ok: true };
}

export async function removeRestaurantMember(actor: Actor, memberId: string): Promise<boolean> {
  const m = await db.restaurantMember.findUnique({ where: { id: memberId }, select: { restaurantId: true } });
  if (!m || !canRestaurant(await restaurantRole(actor, m.restaurantId), "team")) return false;
  await db.restaurantMember.delete({ where: { id: memberId } });
  return true;
}

const PUBLIC_SELECT = {
  id: true,
  name: true,
  description: true,
  city: true,
  district: true,
  addressLine: true,
  lat: true,
  lng: true,
  openingHours: true,
  photoUrl: true,
  pickup: true,
  delivery: true,
  deliveryFee: true,
  deliveryKm: true,
  prepMinutes: true,
  minOrder: true,
  paused: true,
  listingId: true,
  phone: true,
} as const;

export function publicRestaurant(id: string) {
  return db.restaurant.findFirst({
    where: { id, status: "PUBLISHED" },
    select: { ...PUBLIC_SELECT, menu: { where: { available: true }, orderBy: [{ position: "asc" }], select: { id: true, section: true, name: true, description: true, price: true, photoUrl: true } } },
  });
}

const KITCHEN_SELECT = {
  ...PUBLIC_SELECT,
  menu: { where: { available: true }, orderBy: [{ position: "asc" as const }], select: { id: true, section: true, name: true, description: true, price: true, photoUrl: true } },
};

/**
 * The kitchen VIIPA assigned to a place, with its menu (open and with dishes on it). Only an assigned kitchen:
 * a nearby restaurant is never offered instead, and with none the guest is told no restaurant serves the place.
 */
export async function kitchenForPlace(listingId: string) {
  return db.restaurant.findFirst({
    where: { listingId, status: "PUBLISHED", paused: false, menu: { some: { available: true } } },
    orderBy: { createdAt: "asc" },
    select: KITCHEN_SELECT,
  });
}

export type Dish = { id: string; section: string; name: string; description: string; price: number; photoUrl: string | null };

/**
 * What's cooked in the kitchens at VIIPA places, for guests not staying yet (no kitchen names: each guest orders
 * from the kitchen where they stay). Every dish, once by name, dishes with photos first.
 */
export async function foodMenu(limit?: number): Promise<Dish[]> {
  const items = await db.menuItem.findMany({
    where: { available: true, restaurant: { status: "PUBLISHED", listingId: { not: null } } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, section: true, name: true, description: true, price: true, photoUrl: true },
  });
  const seen = new Set<string>();
  const dishes = items.filter((d) => {
    const key = d.name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return dishes.sort((a, b) => Number(!a.photoUrl) - Number(!b.photoUrl)).slice(0, limit);
}

/** Whether any restaurant takes orders: the ORDERS tab only shows when ordering is live. */
export async function ordersLive(): Promise<boolean> {
  return (await db.restaurant.count({ where: { status: "PUBLISHED" } })) > 0;
}

/** The customer's stay right now (paid, under way or today), for ordering to their room. */
async function currentStay(customerId: string, reference: string | null, now: Date) {
  if (!reference) return null;
  const today = new Date(`${todayISO(now)}T00:00:00Z`);
  return db.booking.findFirst({
    where: { reference, guestId: customerId, status: { in: ["CONFIRMED", "CHECKED_IN"] }, checkIn: { lte: today }, checkOut: { gte: today } },
    select: { id: true, reference: true, listingId: true, roomNumber: true, room: { select: { name: true } }, listing: { select: { title: true, lat: true, lng: true } } },
  });
}

export type PlaceOrderResult = { ok: true; reference: string } | { ok: false; error: "invalid" | "closed" | "notOffered" | "tooFar" | "noStay" | "cart" | "minOrder" };

export async function placeOrder(customerId: string, raw: OrderInput, now: Date = new Date()): Promise<PlaceOrderResult> {
  const parsed = orderInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;
  const r = await db.restaurant.findFirst({
    where: { id: input.restaurantId, status: "PUBLISHED" },
    select: { id: true, name: true, ownerId: true, paused: true, pickup: true, delivery: true, deliveryFee: true, deliveryKm: true, minOrder: true, lat: true, lng: true, listingId: true, menu: { select: { id: true, name: true, price: true, available: true } }, team: { where: { role: { in: ["MANAGER", "STAFF"] } }, select: { userId: true } } },
  });
  if (!r) return { ok: false, error: "invalid" };
  if (r.paused) return { ok: false, error: "closed" };
  const cart = priceCart(input.lines, r.menu);
  if (!cart) return { ok: false, error: "cart" };
  if (cart.subtotal < r.minOrder) return { ok: false, error: "minOrder" };

  let address: string | null = null;
  let bookingId: string | null = null;
  const fee = 0;
  // Food is cooked where the guest is staying and brought to their room: no pickup, no delivery elsewhere.
  if (input.fulfilment !== "TO_STAY") return { ok: false, error: "notOffered" };
  const stay = await currentStay(customerId, input.bookingReference, now);
  if (!stay) return { ok: false, error: "noStay" };
  if ((await kitchenForPlace(stay.listingId))?.id !== r.id) return { ok: false, error: "tooFar" };
  bookingId = stay.id;
  address = [stay.listing.title, [stay.room?.name, stay.roomNumber].filter(Boolean).join(" "), stay.reference].filter(Boolean).join(" · ");

  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = newReference("OR");
    try {
      await db.$transaction(async (tx) => {
        const order = await tx.foodOrder.create({
          data: {
            reference,
            restaurantId: r.id,
            customerId,
            fulfilment: input.fulfilment,
            address,
            bookingId,
            phone: input.phone,
            note: input.note,
            subtotal: cart.subtotal,
            deliveryFee: fee,
            total: cart.subtotal + fee,
            // Paid after the restaurant confirms (mobile money, verified by VIIPA) and before the kitchen starts.
            paymentMethod: "PAY_FIRST",
            items: { create: cart.items },
            events: { create: { to: "PLACED", actorId: customerId } },
          },
        });
        await audit(tx, { actorId: customerId, action: "order.place", entityType: "order", entityId: order.reference });
        for (const userId of new Set([r.ownerId, ...r.team.map((m) => m.userId)])) {
          await notify(tx, userId, "orderPlaced", { reference, title: r.name, total: order.total }, `/host/restaurants/${r.id}`);
        }
        // VIIPA staff see every new order (it waits for the guest's payment).
        await notifyAdmins(tx, "orderNew", { reference, title: address ?? r.name, total: order.total }, "/admin/orders");
      });
      return { ok: true, reference };
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  return { ok: false, error: "invalid" };
}

/** Moves an order one step (kitchen, courier or customer, each only their own steps). Every step is kept. */
export async function moveOrder(actor: Actor, reference: string, to: OrderStatus, note = "", now: Date = new Date()): Promise<boolean> {
  await expireOrders(now);
  const order = await db.foodOrder.findUnique({ where: { reference }, select: { id: true, status: true, fulfilment: true, customerId: true, restaurantId: true, courierId: true, paymentMethod: true, paidAt: true, total: true, bookingId: true, address: true, restaurant: { select: { name: true } } } });
  if (!order) return false;
  const role = await restaurantRole(actor, order.restaurantId);
  const actors: OrderActor[] = [];
  if (canRestaurant(role, "orders")) actors.push("kitchen");
  // Delivery steps: the delivery person assigned to this order (or the kitchen, which answers for its delivery).
  if (canRestaurant(role, "deliver") && (!order.courierId || order.courierId === actor.id || actors.includes("kitchen"))) actors.push("courier");
  if (order.customerId === actor.id) actors.push("customer");
  const paid = Boolean(order.paidAt) || order.total <= 0;
  const allowed = actors.some((a) => nextOrderSteps(order.status, order.fulfilment, a, paid).includes(to));
  // A delivery person is assigned with assignCourier (it needs their name); feedback finishes an order.
  if (!allowed || to === "COURIER_ASSIGNED" || to === "FINISHED") return false;
  const why = note.trim().slice(0, 300);
  // Rejecting, cancelling for the guest and a failed delivery all need a reason the guest can read.
  const failed = order.status === "OUT_FOR_DELIVERY" && to === "READY";
  if ((to === "REJECTED" || failed || (to === "CANCELLED" && !actors.includes("customer"))) && !why) return false;
  return db.$transaction(async (tx) => {
    const { count } = await tx.foodOrder.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: to, ...(to === "CANCELLED" || to === "REJECTED" ? { cancelReason: why || null } : {}), ...(failed ? { courierId: null } : {}) },
    });
    if (count !== 1) return false;
    await tx.orderEvent.create({ data: { orderId: order.id, from: order.status, to, actorId: actor.id, note: failed ? `delivery failed: ${why}` : why || null } });
    await audit(tx, { actorId: actor.id, action: `order.${to.toLowerCase()}`, entityType: "order", entityId: reference, ...(why ? { data: { reason: why } } : {}) });
    // The guest follows every step (confirmed: now pay; on its way; delivered…).
    if (order.customerId !== actor.id) await notify(tx, order.customerId, "orderStatus", { reference, title: order.restaurant.name, status: to }, `/orders/${reference}`);
    if (to === "REJECTED") await notifyAdmins(tx, "orderStatus", { reference, title: order.restaurant.name, status: to }, "/admin/orders");
    // On its way to a stay: the place's owner (and its managers) are told, to let it in.
    if (to === "OUT_FOR_DELIVERY" && order.fulfilment === "TO_STAY" && order.bookingId) await notifyPlaceOfOrder(tx, order.bookingId, reference);
    // The guest says they got it: staff are told the order is done.
    if (to === "DELIVERED" && order.customerId === actor.id) await notifyAdmins(tx, "orderReceived", { reference, title: order.address ?? order.restaurant.name }, "/admin/orders");
    return true;
  });
}

/**
 * New orders the restaurant didn't answer within 5 minutes: timed out (nothing is charged — they're paid only after
 * the restaurant confirms). The guest and VIIPA are told, and the dishes are marked unavailable until the restaurant
 * turns them back on. Runs whenever orders are read or moved.
 */
export async function expireOrders(now: Date = new Date()): Promise<number> {
  const late = await db.foodOrder.findMany({
    where: { status: "PLACED", createdAt: { lt: new Date(now.getTime() - ACCEPT_MINUTES * 60_000) } },
    select: { id: true, reference: true, customerId: true, restaurant: { select: { name: true } }, items: { select: { menuItemId: true } } },
    take: 50,
  });
  let n = 0;
  for (const o of late) {
    await db.$transaction(async (tx) => {
      const { count } = await tx.foodOrder.updateMany({ where: { id: o.id, status: "PLACED" }, data: { status: "TIMED_OUT", cancelReason: "timeout" } });
      if (count !== 1) return;
      n++;
      await tx.orderEvent.create({ data: { orderId: o.id, from: "PLACED", to: "TIMED_OUT", note: "no answer within 5 minutes" } });
      const dishes = o.items.map((i) => i.menuItemId).filter((v): v is string => Boolean(v));
      if (dishes.length) await tx.menuItem.updateMany({ where: { id: { in: dishes } }, data: { available: false } });
      await notify(tx, o.customerId, "orderStatus", { reference: o.reference, title: o.restaurant.name, status: "TIMED_OUT" }, `/orders/${o.reference}`);
      await notifyAdmins(tx, "orderTimedOut", { reference: o.reference, title: o.restaurant.name }, "/admin/orders");
    });
  }
  return n;
}

/** The kitchen hands a ready order to one of its delivery people (name and phone shown to the guest). */
export async function assignCourier(actor: Actor, reference: string, courierId: string): Promise<boolean> {
  const order = await db.foodOrder.findUnique({ where: { reference }, select: { id: true, status: true, restaurantId: true, customerId: true, restaurant: { select: { name: true } } } });
  if (!order || order.status !== "READY" || !canRestaurant(await restaurantRole(actor, order.restaurantId), "orders")) return false;
  const courier = await db.restaurantMember.findFirst({ where: { restaurantId: order.restaurantId, userId: courierId, role: "DELIVERY" }, select: { userId: true } });
  if (!courier) return false;
  return db.$transaction(async (tx) => {
    const { count } = await tx.foodOrder.updateMany({ where: { id: order.id, status: "READY" }, data: { status: "COURIER_ASSIGNED", courierId } });
    if (count !== 1) return false;
    await tx.orderEvent.create({ data: { orderId: order.id, from: "READY", to: "COURIER_ASSIGNED", actorId: actor.id, note: courierId } });
    await notify(tx, courierId, "orderStatus", { reference, title: order.restaurant.name, status: "COURIER_ASSIGNED" }, `/host/restaurants/${order.restaurantId}`);
    await notify(tx, order.customerId, "orderStatus", { reference, title: order.restaurant.name, status: "COURIER_ASSIGNED" }, `/orders/${reference}`);
    return true;
  });
}

/** The guest's feedback once the food is delivered (1–5 and a comment): the order is finished. */
export async function rateOrder(customerId: string, reference: string, rating: number, comment: string): Promise<boolean> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof comment !== "string") return false;
  const { count } = await db.foodOrder.updateMany({ where: { reference, customerId, status: "DELIVERED" }, data: { status: "FINISHED", rating, feedback: comment.trim().slice(0, 500) || null } });
  if (count === 1) {
    const order = await db.foodOrder.findUniqueOrThrow({ where: { reference }, select: { id: true } });
    await db.orderEvent.create({ data: { orderId: order.id, from: "DELIVERED", to: "FINISHED", actorId: customerId, note: `rating ${rating}` } });
  }
  return count === 1;
}

/** Tells the owner and managers of the place a guest stays at that the guest's food order is on its way there. */
async function notifyPlaceOfOrder(tx: Prisma.TransactionClient, bookingId: string, reference: string) {
  const booking = await tx.booking.findUnique({
    where: { id: bookingId },
    select: { roomNumber: true, room: { select: { name: true } }, guest: { select: { name: true } }, listing: { select: { title: true, hostId: true, team: { where: { role: "MANAGER" }, select: { userId: true } } } } },
  });
  if (!booking) return;
  const where = [booking.listing.title, [booking.room?.name, booking.roomNumber].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
  for (const userId of new Set([booking.listing.hostId, ...booking.listing.team.map((m) => m.userId)])) {
    await notify(tx, userId, "orderSentToStay", { reference, name: booking.guest.name, where }, "/host/orders");
  }
}

/** Orders shown to a place's owner: confirmed ones and on, read only. */
export const HOST_ORDER_STATUSES = ["PAID", "PREPARING", "READY", "COURIER_ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "FINISHED"] as const;

/**
 * Food orders of guests staying at the places this person owns or manages (last 30 days), newest first: the
 * order number, the guest, their room and what's in it, so whoever receives it at the place can hand it over.
 */
export async function ordersForHost(userId: string, now: Date = new Date()) {
  const bookings = await db.booking.findMany({
    where: { checkOut: { gte: new Date(now.getTime() - 30 * 86_400_000) }, listing: { OR: [{ hostId: userId }, { team: { some: { userId, role: "MANAGER" } } }] } },
    select: { id: true, reference: true, roomNumber: true, room: { select: { name: true } }, guest: { select: { name: true, phone: true } }, listing: { select: { id: true, title: true } } },
  });
  if (bookings.length === 0) return [];
  const byId = new Map(bookings.map((b) => [b.id, b]));
  const orders = await db.foodOrder.findMany({
    where: { bookingId: { in: [...byId.keys()] }, status: { in: [...HOST_ORDER_STATUSES] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { reference: true, status: true, createdAt: true, bookingId: true, note: true, items: { select: { name: true, quantity: true } }, events: { where: { to: "OUT_FOR_DELIVERY" }, select: { createdAt: true }, take: 1 } },
  });
  return orders.map(({ bookingId, events, ...o }) => ({ ...o, sentAt: events[0]?.createdAt ?? null, stay: byId.get(bookingId!)! }));
}

/** One of the customer's orders with its steps, for the tracking page. */
export async function myOrder(customerId: string, reference: string) {
  await expireOrders();
  return db.foodOrder.findFirst({
    where: { customerId, reference },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      restaurant: { select: { id: true, name: true, phone: true, addressLine: true, district: true, city: true, lat: true, lng: true, prepMinutes: true, photoUrl: true, listing: { select: { title: true } } } },
    },
  });
}

export async function myOrders(customerId: string) {
  await expireOrders();
  return db.foodOrder.findMany({
    where: { customerId, hiddenByCustomer: false },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true, restaurant: { select: { id: true, name: true, phone: true, photoUrl: true, prepMinutes: true, listing: { select: { title: true } } } }, events: { orderBy: { createdAt: "asc" } } },
  });
}

/** A restaurant's orders for its team: open ones first. */
export async function restaurantOrders(restaurantId: string, take = 100) {
  await expireOrders();
  return db.foodOrder.findMany({
    where: { restaurantId },
    orderBy: [{ createdAt: "desc" }],
    take,
    include: { items: true, customer: { select: { name: true } } },
  });
}

/** Restaurants someone owns or works at (with their role). */
export async function restaurantsRunBy(userId: string) {
  const [owned, member] = await Promise.all([
    db.restaurant.findMany({ where: { ownerId: userId }, select: { id: true, name: true, city: true, status: true, paused: true } }),
    db.restaurantMember.findMany({ where: { userId }, select: { role: true, restaurant: { select: { id: true, name: true, city: true, status: true, paused: true } } } }),
  ]);
  return [...owned.map((r) => ({ ...r, role: "OWNER" as const })), ...member.map((m) => ({ ...m.restaurant, role: m.role }))];
}

export function restaurantForTeam(id: string) {
  return db.restaurant.findUnique({
    where: { id },
    include: { menu: { orderBy: { position: "asc" } }, team: { include: { user: { select: { name: true, email: true, emailVerified: true } } } }, owner: { select: { id: true, name: true, email: true } } },
  });
}

export function allRestaurants(status?: "DRAFT" | "PUBLISHED" | "HIDDEN") {
  return db.restaurant.findMany({
    where: status ? { status } : {},
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { id: true, name: true, city: true, status: true, paused: true, owner: { select: { name: true } }, _count: { select: { menu: true, orders: true } } },
  });
}

const TX = /^[A-Za-z0-9._\-/ ]{4,60}$/;

/** The customer removes a cancelled order from their list (staff and the kitchen keep it). */
export async function hideMyOrder(customerId: string, reference: string): Promise<boolean> {
  const { count } = await db.foodOrder.updateMany({ where: { reference, customerId, status: "CANCELLED" }, data: { hiddenByCustomer: true } });
  return count === 1;
}

export type ClaimOrderResult = { ok: true } | { ok: false; error: "notFound" | "transaction" };

/** The customer says they paid the order by mobile money and gives the transaction id; VIIPA staff confirm. */
export async function claimOrderPayment(customerId: string, reference: string, transactionId: string): Promise<ClaimOrderResult> {
  const tx = transactionId.trim();
  if (!TX.test(tx)) return { ok: false, error: "transaction" };
  // The guest pays only once the restaurant has confirmed the order.
  const order = await db.foodOrder.findFirst({ where: { reference, customerId, status: "ACCEPTED", paidAt: null }, select: { id: true, total: true, restaurant: { select: { name: true } } } });
  if (!order) return { ok: false, error: "notFound" };
  await db.$transaction(async (t) => {
    await t.foodOrder.update({ where: { id: order.id }, data: { paymentClaim: tx } });
    await audit(t, { actorId: customerId, action: "order.paymentClaim", entityType: "order", entityId: reference, data: { providerReference: tx } });
    await notifyAdmins(t, "orderPaymentClaim", { reference, title: order.restaurant.name, total: order.total }, "/admin/orders");
  });
  return { ok: true };
}

export type ConfirmOrderResult = { ok: true } | { ok: false; error: "notAllowed" | "notFound" | "transaction" | "used" };

/**
 * VIIPA staff confirm the order's money arrived. The payment, the platform's commission and the kitchen owner's
 * share go to the ledger once; the kitchen is told it can start.
 */
export async function confirmOrderPayment(actor: Actor, reference: string, transactionId?: string, now: Date = new Date()): Promise<ConfirmOrderResult> {
  if (!canStaff(actor, "food")) return { ok: false, error: "notAllowed" };
  const order = await db.foodOrder.findUnique({
    where: { reference },
    select: { id: true, total: true, status: true, paidAt: true, paymentClaim: true, customerId: true, bookingId: true, restaurant: { select: { id: true, name: true, ownerId: true, team: { where: { role: { in: ["MANAGER", "STAFF"] } }, select: { userId: true } } } } },
  });
  // Payment comes after the restaurant confirmed (ACCEPTED); older orders may still be waiting at PLACED.
  if (!order || order.paidAt || !["ACCEPTED", "PLACED"].includes(order.status) || order.total <= 0) return { ok: false, error: "notFound" };
  const tx = (transactionId ?? order.paymentClaim ?? "").trim();
  if (!TX.test(tx)) return { ok: false, error: "transaction" };
  if (await db.foodOrder.findUnique({ where: { paidReference: tx }, select: { id: true } })) return { ok: false, error: "used" };
  // The restaurant's commission agreement in force at payment (a % or a fixed fee), else the platform's rate.
  const commission = commissionUnder(await agreementAt("RESTAURANT", order.restaurant.id, now), order.total) ?? Math.round((order.total * ((await readSettings()).commissionBps ?? 0)) / 10_000);
  const done = await db.$transaction(async (t) => {
    const { count } = await t.foodOrder.updateMany({ where: { id: order.id, paidAt: null }, data: { paidAt: now, paidReference: tx } });
    if (count !== 1) return false;
    const note = `food ${reference}`;
    await t.ledgerEntry.createMany({
      data: [
        { kind: "GUEST_PAYMENT" as const, amount: order.total, bookingId: order.bookingId, note },
        { kind: "COMMISSION" as const, amount: commission, bookingId: order.bookingId, note },
        { kind: "HOST_PAYABLE" as const, amount: order.total - commission, bookingId: order.bookingId, hostId: order.restaurant.ownerId, note },
      ].filter((e) => e.amount > 0),
    });
    await audit(t, { actorId: actor.id, action: "order.paid", entityType: "order", entityId: reference, data: { amount: order.total, commission, providerReference: tx } });
    // Paid: the kitchen can start (it is told), and the guest sees it's paid.
    await t.foodOrder.update({ where: { id: order.id }, data: { status: "PAID" } });
    await t.orderEvent.create({ data: { orderId: order.id, from: order.status, to: "PAID", actorId: actor.id } });
    await notify(t, order.customerId, "orderStatus", { reference, title: order.restaurant.name, status: "PAID" }, `/orders/${reference}`);
    for (const userId of new Set([order.restaurant.ownerId, ...order.restaurant.team.map((m) => m.userId)])) {
      await notify(t, userId, "orderPaid", { reference, title: order.restaurant.name, total: order.total }, `/host/restaurants/${order.restaurant.id}`);
    }
    return true;
  });
  return done ? { ok: true } : { ok: false, error: "notFound" };
}

/** Staff: orders the restaurant confirmed that wait for payment to be verified (the ones the guest says they paid first). */
export async function ordersAwaitingPayment(take = 100) {
  await expireOrders();
  return db.foodOrder.findMany({
    where: { paidAt: null, status: { in: ["ACCEPTED", "PLACED"] }, total: { gt: 0 } },
    orderBy: [{ paymentClaim: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take,
    select: { reference: true, total: true, paymentClaim: true, createdAt: true, address: true, phone: true, note: true, items: { select: { name: true, quantity: true } }, restaurant: { select: { name: true } }, customer: { select: { name: true } } },
  });
}

/** Staff: every kitchen's orders, newest first (open ones are picked out on the page). */
export async function allOrders(take = 150) {
  await expireOrders();
  return db.foodOrder.findMany({
    orderBy: [{ createdAt: "desc" }],
    take,
    include: { items: true, customer: { select: { name: true } }, restaurant: { select: { name: true } } },
  });
}

/** Staff delete a restaurant that never had an order (with its menu and team); one with orders can only be hidden. */
export async function deleteRestaurant(actor: Actor, id: string): Promise<{ ok: true } | { ok: false; error: "notAllowed" | "hasOrders" | "notFound" }> {
  if (!canStaff(actor, "food")) return { ok: false, error: "notAllowed" };
  const r = await db.restaurant.findUnique({ where: { id }, select: { name: true, _count: { select: { orders: true } } } });
  if (!r) return { ok: false, error: "notFound" };
  if (r._count.orders > 0) return { ok: false, error: "hasOrders" };
  await db.$transaction(async (tx) => {
    await tx.restaurant.delete({ where: { id } });
    await audit(tx, { actorId: actor.id, action: "restaurant.delete", entityType: "restaurant", entityId: id, data: { name: r.name } });
  });
  return { ok: true };
}

/** Staff delete a cancelled order that was never paid (e.g. a test); paid orders stay for the accounts. */
export async function deleteFoodOrder(actor: Actor, reference: string): Promise<boolean> {
  if (!canStaff(actor, "food")) return false;
  return db.$transaction(async (tx) => {
    const { count } = await tx.foodOrder.deleteMany({ where: { reference, status: "CANCELLED", paidAt: null } });
    if (count === 1) await audit(tx, { actorId: actor.id, action: "order.delete", entityType: "order", entityId: reference });
    return count === 1;
  });
}
