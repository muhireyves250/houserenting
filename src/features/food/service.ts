import "server-only";
import { audit } from "@/features/audit/service";
import { newReference } from "@/features/bookings/reference";
import { notify } from "@/features/notifications/service";
import { todayISO } from "@/features/search/date-range";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { distanceKm, nextOrderSteps, priceCart, type OrderActor, type OrderStatus } from "./rules";
import { menuItemInput, orderInput, restaurantInput, type MenuItemInput, type OrderInput, type RestaurantInput } from "./validation";

type Actor = { id: string; role?: string | null };
export type RestaurantRole = "staff" | "owner" | "manager" | "kitchen" | "courier";
export type RestaurantAction = "edit" | "menu" | "team" | "orders" | "deliver" | "pause";

const ALLOWED: Record<RestaurantRole, readonly RestaurantAction[]> = {
  staff: ["edit", "menu", "team", "orders", "deliver", "pause"],
  owner: ["edit", "menu", "team", "orders", "deliver", "pause"],
  manager: ["edit", "menu", "orders", "pause"],
  kitchen: ["orders"],
  courier: ["deliver"],
};

export const canRestaurant = (role: RestaurantRole | null, action: RestaurantAction) => role !== null && ALLOWED[role].includes(action);

export async function restaurantRole(actor: Actor, restaurantId: string): Promise<RestaurantRole | null> {
  if (isAdmin(actor)) return "staff";
  const r = await db.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true, team: { where: { userId: actor.id }, select: { role: true } } } });
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
  if (isAdmin(actor)) return true;
  return (await db.listing.count({ where: { hostId: actor.id, status: { not: "ARCHIVED" } } })) > 0;
}

/** Owners or staff create a restaurant (a draft until staff publish it); its owner, managers or staff edit it. */
export async function saveRestaurant(actor: Actor, id: string | null, raw: RestaurantInput, ownerId?: string): Promise<SaveRestaurantResult> {
  const parsed = restaurantInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: errorsOf(parsed.error.issues) };
  const data = parsed.data;
  if (data.listingId) {
    const listing = await db.listing.findUnique({ where: { id: data.listingId }, select: { hostId: true } });
    if (!listing || (!isAdmin(actor) && listing.hostId !== (ownerId ?? actor.id))) data.listingId = null;
  }
  if (id === null) {
    if (!(await canAddRestaurant(actor))) return { ok: false, error: "notAllowed" };
    const owner = isAdmin(actor) && ownerId ? ownerId : actor.id;
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
  if (!isAdmin(actor)) return false;
  const why = reason.trim().slice(0, 500);
  if (status === "HIDDEN" && !why) return false;
  const r = await db.restaurant.findUnique({ where: { id }, select: { status: true, ownerId: true, name: true, _count: { select: { menu: true } } } });
  if (!r || r.status === status || (status === "PUBLISHED" && r._count.menu === 0)) return false;
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
    db.user.findUnique({ where: { email: email.trim().toLowerCase() }, select: { id: true } }),
    db.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true, name: true } }),
  ]);
  if (!user) return { ok: false, error: "noAccount" };
  if (!r || r.ownerId === user.id) return { ok: false, error: "isOwner" };
  await db.$transaction(async (tx) => {
    await tx.restaurantMember.upsert({ where: { restaurantId_userId: { restaurantId, userId: user.id } }, create: { restaurantId, userId: user.id, role, addedById: actor.id }, update: { role } });
    await audit(tx, { actorId: actor.id, action: "restaurant.team", entityType: "restaurant", entityId: restaurantId, data: { user: user.id, role } });
    await notify(tx, user.id, "restaurantTeamAdded", { title: r.name, roleLabel: role }, `/host/restaurants/${restaurantId}`);
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
  paused: true,
  listingId: true,
  phone: true,
} as const;

/** Published restaurants, nearest first when a point is known (the guest's stay, or their location). */
export async function restaurantsNear(point: { lat: number; lng: number } | null, listingId: string | null = null) {
  const rows = await db.restaurant.findMany({ where: { status: "PUBLISHED" }, select: PUBLIC_SELECT, take: 300 });
  const withDistance = rows.map((r) => ({ ...r, km: point ? distanceKm(point, r) : null, atYourStay: listingId !== null && r.listingId === listingId }));
  return withDistance.sort((a, b) => Number(b.atYourStay) - Number(a.atYourStay) || (a.km ?? 0) - (b.km ?? 0) || a.name.localeCompare(b.name));
}

export function publicRestaurant(id: string) {
  return db.restaurant.findFirst({
    where: { id, status: "PUBLISHED" },
    select: { ...PUBLIC_SELECT, menu: { where: { available: true }, orderBy: [{ position: "asc" }], select: { id: true, section: true, name: true, description: true, price: true } } },
  });
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
    select: { id: true, reference: true, listingId: true, room: { select: { name: true } }, listing: { select: { title: true, lat: true, lng: true } } },
  });
}

export type PlaceOrderResult = { ok: true; reference: string } | { ok: false; error: "invalid" | "closed" | "notOffered" | "tooFar" | "noStay" | "cart" };

export async function placeOrder(customerId: string, raw: OrderInput, now: Date = new Date()): Promise<PlaceOrderResult> {
  const parsed = orderInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;
  const r = await db.restaurant.findFirst({
    where: { id: input.restaurantId, status: "PUBLISHED" },
    select: { id: true, name: true, ownerId: true, paused: true, pickup: true, delivery: true, deliveryFee: true, deliveryKm: true, lat: true, lng: true, listingId: true, menu: { select: { id: true, name: true, price: true, available: true } }, team: { where: { role: { in: ["MANAGER", "STAFF"] } }, select: { userId: true } } },
  });
  if (!r) return { ok: false, error: "invalid" };
  if (r.paused) return { ok: false, error: "closed" };
  const cart = priceCart(input.lines, r.menu);
  if (!cart) return { ok: false, error: "cart" };

  let address: string | null = null;
  let bookingId: string | null = null;
  let fee = 0;
  if (input.fulfilment === "PICKUP") {
    if (!r.pickup) return { ok: false, error: "notOffered" };
  } else if (input.fulfilment === "DELIVERY") {
    if (!r.delivery) return { ok: false, error: "notOffered" };
    if (!input.address || input.address.length < 5) return { ok: false, error: "invalid" };
    address = input.address;
    fee = r.deliveryFee;
  } else {
    const stay = await currentStay(customerId, input.bookingReference, now);
    if (!stay) return { ok: false, error: "noStay" };
    // The restaurant at the place itself, or one that delivers that far.
    const atPlace = r.listingId === stay.listingId;
    if (!atPlace && (!r.delivery || distanceKm(r, stay.listing) > r.deliveryKm)) return { ok: false, error: "tooFar" };
    bookingId = stay.id;
    address = [stay.listing.title, stay.room?.name, stay.reference].filter(Boolean).join(" · ");
    fee = atPlace ? 0 : r.deliveryFee;
  }

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
            items: { create: cart.items },
            events: { create: { to: "PLACED", actorId: customerId } },
          },
        });
        await audit(tx, { actorId: customerId, action: "order.place", entityType: "order", entityId: order.reference });
        for (const userId of new Set([r.ownerId, ...r.team.map((m) => m.userId)])) {
          await notify(tx, userId, "orderPlaced", { reference, title: r.name, total: order.total }, `/host/restaurants/${r.id}`);
        }
      });
      return { ok: true, reference };
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  return { ok: false, error: "invalid" };
}

/** Moves an order one step (kitchen, courier or customer, each only their own steps). Every step is kept. */
export async function moveOrder(actor: Actor, reference: string, to: OrderStatus, note = ""): Promise<boolean> {
  const order = await db.foodOrder.findUnique({ where: { reference }, select: { id: true, status: true, fulfilment: true, customerId: true, restaurantId: true, courierId: true, restaurant: { select: { name: true } } } });
  if (!order) return false;
  const role = await restaurantRole(actor, order.restaurantId);
  const actors: OrderActor[] = [];
  if (canRestaurant(role, "orders")) actors.push("kitchen");
  if (canRestaurant(role, "deliver")) actors.push("courier");
  if (order.customerId === actor.id) actors.push("customer");
  const allowed = actors.some((a) => nextOrderSteps(order.status, order.fulfilment, a).includes(to));
  if (!allowed) return false;
  // Once out, only the courier who took it (or the kitchen/staff) marks it delivered.
  if (to === "DELIVERED" && order.status === "OUT_FOR_DELIVERY" && !actors.includes("kitchen") && order.courierId && order.courierId !== actor.id) return false;
  const why = note.trim().slice(0, 300);
  if (to === "CANCELLED" && actors.includes("kitchen") && !actors.includes("customer") && !why) return false;
  return db.$transaction(async (tx) => {
    const { count } = await tx.foodOrder.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: to, ...(to === "OUT_FOR_DELIVERY" && actors.includes("courier") ? { courierId: actor.id } : {}), ...(to === "CANCELLED" ? { cancelReason: why || null } : {}) },
    });
    if (count !== 1) return false;
    await tx.orderEvent.create({ data: { orderId: order.id, from: order.status, to, actorId: actor.id, note: why || null } });
    if (order.customerId !== actor.id) await notify(tx, order.customerId, "orderStatus", { reference, title: order.restaurant.name, status: to }, "/orders");
    return true;
  });
}

export function myOrders(customerId: string) {
  return db.foodOrder.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { items: true, restaurant: { select: { name: true, phone: true } }, events: { orderBy: { createdAt: "asc" } } },
  });
}

/** A restaurant's orders for its team: open ones first. */
export function restaurantOrders(restaurantId: string, take = 100) {
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
    include: { menu: { orderBy: { position: "asc" } }, team: { include: { user: { select: { name: true, email: true } } } }, owner: { select: { id: true, name: true, email: true } } },
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
