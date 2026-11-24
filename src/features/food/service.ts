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
import { isCustomer } from "@/lib/customer";
import { canStaff } from "@/lib/roles";
import { ACCEPT_MINUTES, nextOrderSteps, priceCart, type OrderActor, type OrderStatus } from "./rules";
import { menuItemInput, orderInput, restaurantInput, type MenuItemInput, type OrderInput, type RestaurantInput } from "./validation";

type Actor = { id: string; role?: string | null };
export type RestaurantRole = "staff" | "owner" | "manager" | "kitchen" | "courier";
export type RestaurantAction = "edit" | "menu" | "team" | "orders" | "deliver" | "pause" | "delivery" | "reviews" | "money";

const ALLOWED: Record<RestaurantRole, readonly RestaurantAction[]> = {
  staff: ["edit", "menu", "team", "orders", "deliver", "pause", "delivery", "reviews", "money"],
  // The owner runs everything at their restaurant: its details, menu, orders and its people (managers and delivery
  // people, added by their exact email); a manager adds delivery people only.
  owner: ["edit", "menu", "team", "orders", "deliver", "pause", "delivery", "reviews", "money"],
  // A manager runs the orders and the menu, sees the reviews and adds delivery people; only the owner edits the details.
  manager: ["menu", "orders", "pause", "delivery", "reviews", "money"],
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
  // VIIPA staff, and people VIIPA gave the restaurant owner/manager role.
  if (canStaff(actor, "food")) return true;
  return Boolean((await db.user.findUnique({ where: { id: actor.id }, select: { isRestaurateur: true, status: true } }))?.isRestaurateur);
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
    const staff = canStaff(actor, "food");
    const owner = staff && ownerId ? ownerId : actor.id;
    // Staff set a restaurant up for someone with the restaurant owner/manager role (or for VIIPA itself).
    if (staff && ownerId && !(await db.user.findFirst({ where: { id: ownerId, isRestaurateur: true, status: "ACTIVE" }, select: { id: true } }))) return { ok: false, errors: { ownerEmail: "notRestaurateur" } };
    const created = await db.restaurant.create({ data: { ...data, ownerId: owner, ...(data.listingId ? { places: { create: { listingId: data.listingId, addedById: actor.id } } } : {}) } });
    await audit(db, { actorId: actor.id, action: "restaurant.create", entityType: "restaurant", entityId: created.id });
    // Set up by its owner: VIIPA checks it (and its menu) before it goes live.
    if (!staff) await notifyAdmins(db, "restaurantNew", { title: created.name }, `/admin/restaurants/${created.id}`);
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

export async function addRestaurantMember(actor: Actor, restaurantId: string, email: string, role: RestaurantTeamRole): Promise<{ ok: true } | { ok: false; error: "notAllowed" | "noAccount" | "isOwner" | "invalid" | "hasRole" }> {
  if (!RESTAURANT_TEAM_ROLES.includes(role) || typeof email !== "string" || email.length > 200) return { ok: false, error: "invalid" };
  // VIIPA staff and the owner add managers and delivery people; a manager adds delivery people only.
  const can = await restaurantRole(actor, restaurantId);
  if (!canRestaurant(can, "team") && !(canRestaurant(can, "delivery") && role === "DELIVERY")) return { ok: false, error: "notAllowed" };
  const [user, r] = await Promise.all([
    db.user.findFirst({ where: { email: email.trim().toLowerCase(), status: "ACTIVE", role: "USER" }, select: { id: true, name: true, email: true } }),
    db.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true, name: true } }),
  ]);
  if (!user) return { ok: false, error: "noAccount" };
  if (!r || r.ownerId === user.id) return { ok: false, error: "isOwner" };
  // One role per person: only a customer can join (not someone with another role already).
  if (!(await isCustomer(user.id))) return { ok: false, error: "hasRole" };
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
  const m = await db.restaurantMember.findUnique({ where: { id: memberId }, select: { restaurantId: true, role: true } });
  if (!m) return false;
  // Staff and the owner remove anyone; a manager removes delivery people.
  const can = await restaurantRole(actor, m.restaurantId);
  if (!canRestaurant(can, "team") && !(canRestaurant(can, "delivery") && m.role === "DELIVERY")) return false;
  await db.restaurantMember.delete({ where: { id: memberId } });
  return true;
}

export type KitchenApplyResult = { ok: true } | { ok: false; error: "notAllowed" | "notFound" | "already" | "pending" | "invalid" };

/** A restaurant's owner applies to cook for a place's guests (VIIPA is told and decides). */
export async function applyToCook(actor: Actor, restaurantId: string, listingId: string, note = ""): Promise<KitchenApplyResult> {
  if (typeof listingId !== "string" || typeof note !== "string" || note.length > 500) return { ok: false, error: "invalid" };
  const role = await restaurantRole(actor, restaurantId);
  if (role !== "owner" && role !== "staff") return { ok: false, error: "notAllowed" };
  const [r, listing] = await Promise.all([
    db.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true } }),
    db.listing.findFirst({ where: { id: listingId, status: "PUBLISHED" }, select: { title: true } }),
  ]);
  if (!r || !listing) return { ok: false, error: "notFound" };
  if (await db.placeRestaurant.findUnique({ where: { listingId_restaurantId: { listingId, restaurantId } }, select: { id: true } })) return { ok: false, error: "already" };
  if (await db.kitchenRequest.findFirst({ where: { restaurantId, listingId, status: "PENDING" }, select: { id: true } })) return { ok: false, error: "pending" };
  await db.$transaction(async (tx) => {
    const req = await tx.kitchenRequest.create({ data: { restaurantId, listingId, note: note.trim() || null, requestedById: actor.id } });
    await audit(tx, { actorId: actor.id, action: "restaurant.applyToCook", entityType: "restaurant", entityId: restaurantId, data: { listingId, request: req.id } });
    await notifyAdmins(tx, "kitchenRequest", { title: r.name, place: listing.title }, `/admin/restaurants/${restaurantId}`);
  });
  return { ok: true };
}

/** VIIPA approves an application (the restaurant then cooks for the place) or declines it with a reason. */
export async function decideKitchenRequest(actor: Actor, requestId: string, approve: boolean, reason = ""): Promise<boolean> {
  if (!canStaff(actor, "food") || typeof reason !== "string") return false;
  const why = reason.trim().slice(0, 300);
  if (!approve && !why) return false;
  return db.$transaction(async (tx) => {
    const req = await tx.kitchenRequest.findUnique({ where: { id: requestId }, select: { id: true, status: true, restaurantId: true, listingId: true, restaurant: { select: { name: true, ownerId: true } }, listing: { select: { title: true } } } });
    if (!req || req.status !== "PENDING") return false;
    await tx.kitchenRequest.update({ where: { id: req.id }, data: { status: approve ? "APPROVED" : "DECLINED", reason: why || null, decidedById: actor.id, decidedAt: new Date() } });
    if (approve) await tx.placeRestaurant.upsert({ where: { listingId_restaurantId: { listingId: req.listingId, restaurantId: req.restaurantId } }, create: { listingId: req.listingId, restaurantId: req.restaurantId, addedById: actor.id }, update: {} });
    await audit(tx, { actorId: actor.id, action: approve ? "restaurant.cookApproved" : "restaurant.cookDeclined", entityType: "restaurant", entityId: req.restaurantId, data: { listingId: req.listingId, ...(why ? { reason: why } : {}) } });
    await notify(tx, req.restaurant.ownerId, approve ? "kitchenApproved" : "kitchenDeclined", { title: req.restaurant.name, place: req.listing.title, reason: why }, `/host/restaurants/${req.restaurantId}?tab=places`);
    return true;
  });
}

/** A restaurant's applications (newest first) and the places it cooks for. */
export async function restaurantPlaces(restaurantId: string) {
  const [serving, requests] = await Promise.all([
    db.placeRestaurant.findMany({ where: { restaurantId }, orderBy: { createdAt: "asc" }, select: { listing: { select: { id: true, title: true, city: true } } } }),
    db.kitchenRequest.findMany({ where: { restaurantId }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, status: true, reason: true, createdAt: true, listing: { select: { id: true, title: true, city: true } } } }),
  ]);
  return { serving: serving.map((s) => s.listing), requests };
}

/** Places a restaurant can apply to cook for: live places it doesn't serve yet. */
export function placesToApply(restaurantId: string) {
  return db.listing.findMany({ where: { status: "PUBLISHED", kitchens: { none: { restaurantId } } }, orderBy: [{ city: "asc" }, { title: "asc" }], select: { id: true, title: true, city: true }, take: 300 });
}

/** Staff: applications waiting for an answer (for one place, one restaurant, or all). */
export function pendingKitchenRequests(listingId?: string, restaurantId?: string) {
  return db.kitchenRequest.findMany({ where: { status: "PENDING", ...(listingId ? { listingId } : {}), ...(restaurantId ? { restaurantId } : {}) }, orderBy: { createdAt: "asc" }, select: { id: true, note: true, createdAt: true, restaurant: { select: { id: true, name: true, city: true } }, listing: { select: { id: true, title: true } } } });
}

/** Kigali day (UTC+2) of a moment, as YYYY-MM-DD. */
const kigaliDay = (d: Date) => new Date(d.getTime() + 2 * 3_600_000).toISOString().slice(0, 10);

/**
 * A restaurant's money from its orders: each paid order with what the guest paid, VIIPA's commission and the
 * restaurant's share; totals for today and this month; and a report day by day (the last `days` days).
 */
export async function restaurantMoney(restaurantId: string, now: Date = new Date(), days = 31) {
  const since = new Date(now.getTime() - days * 86_400_000);
  const orders = await db.foodOrder.findMany({
    where: { restaurantId, paidAt: { gte: since } },
    orderBy: { paidAt: "desc" },
    select: { reference: true, paidAt: true, total: true, status: true, paymentClaim: true, customer: { select: { name: true } }, items: { select: { name: true, quantity: true, price: true } } },
  });
  const ledger = orders.length
    ? await db.ledgerEntry.findMany({ where: { note: { in: orders.map((o) => `food ${o.reference}`) }, kind: { in: ["COMMISSION", "HOST_PAYABLE"] } }, select: { kind: true, amount: true, note: true } })
    : [];
  const part = (ref: string, kind: "COMMISSION" | "HOST_PAYABLE") => ledger.filter((e) => e.note === `food ${ref}` && e.kind === kind).reduce((n, e) => n + e.amount, 0);
  const rows = orders.map((o) => {
    const commission = part(o.reference, "COMMISSION");
    const share = part(o.reference, "HOST_PAYABLE") || o.total - commission;
    return { ...o, customer: o.customer.name, paidAt: o.paidAt!, day: kigaliDay(o.paidAt!), commission, share };
  });
  const sum = (list: typeof rows) => ({ orders: list.length, sales: list.reduce((n, r) => n + r.total, 0), commission: list.reduce((n, r) => n + r.commission, 0), share: list.reduce((n, r) => n + r.share, 0) });
  const today = kigaliDay(now);
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]);
  return {
    today: sum(rows.filter((r) => r.day === today)),
    month: sum(rows.filter((r) => r.day.slice(0, 7) === today.slice(0, 7))),
    days: [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([day, list]) => ({ day, ...sum(list) })),
    orders: rows,
  };
}

export type FoundPerson = { ok: true; name: string; email: string } | { ok: false; error: "notAllowed" | "noAccount" | "hasRole" | "invalid" };

/**
 * The owner or a manager looks up who they want as a delivery person by their exact email (they never see a list of
 * people): their name comes back so they can check it is the right person before adding them. Only customers.
 */
export async function findPersonByEmail(actor: Actor, restaurantId: string, email: string): Promise<FoundPerson> {
  if (typeof email !== "string" || email.length > 200 || !email.includes("@")) return { ok: false, error: "invalid" };
  if (!canRestaurant(await restaurantRole(actor, restaurantId), "delivery")) return { ok: false, error: "notAllowed" };
  const user = await db.user.findFirst({ where: { email: email.trim().toLowerCase(), status: "ACTIVE" }, select: { id: true, name: true, email: true } });
  if (!user) return { ok: false, error: "noAccount" };
  if (!(await isCustomer(user.id))) return { ok: false, error: "hasRole" };
  return { ok: true, name: user.name, email: user.email };
}

/** What guests said about a restaurant's food (their star rating and comment after an order), newest first. */
export async function restaurantReviews(restaurantId: string, take = 100) {
  const rows = await db.foodOrder.findMany({
    where: { restaurantId, rating: { not: null } },
    orderBy: { updatedAt: "desc" },
    take,
    select: { reference: true, rating: true, feedback: true, updatedAt: true, customer: { select: { name: true } }, items: { select: { name: true, quantity: true } } },
  });
  const average = rows.length ? rows.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rows.length : null;
  return { average, rows: rows.map((r) => ({ ...r, customer: r.customer.name.split(" ")[0] ?? "" })) };
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

/** The restaurants VIIPA set to cook for a place that are taking orders now (open, with dishes on the menu). */
function kitchensForPlace(listingId: string) {
  return db.restaurant.findMany({
    where: { places: { some: { listingId } }, status: "PUBLISHED", paused: false, menu: { some: { available: true } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      ownerId: true,
      prepMinutes: true,
      minOrder: true,
      menu: { where: { available: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, section: true, name: true, description: true, price: true, photoUrl: true, available: true } },
      team: { where: { role: { in: ["MANAGER", "STAFF"] } }, select: { userId: true } },
    },
  });
}

/**
 * The kitchen at a place, as guests see it: one menu with the dishes of every restaurant VIIPA set to cook there
 * (no restaurant names), ready in the slowest one's time. Only assigned restaurants: a nearby one is never offered
 * instead, and with none the guest is told no restaurant serves the place.
 */
export async function kitchenForPlace(listingId: string) {
  const kitchens = await kitchensForPlace(listingId);
  if (kitchens.length === 0) return null;
  return {
    // One cart for the stay's menu, whichever restaurants cook it (Order again fills the same one).
    id: "stay",
    paused: false,
    prepMinutes: Math.max(...kitchens.map((k) => k.prepMinutes)),
    minOrder: Math.max(...kitchens.map((k) => k.minOrder)),
    menu: kitchens.flatMap((k) => k.menu.map((d) => ({ id: d.id, section: d.section, name: d.name, description: d.description, price: d.price, photoUrl: d.photoUrl }))),
  };
}

export type Dish = { id: string; section: string; name: string; description: string; price: number; photoUrl: string | null };

/**
 * What's cooked in the kitchens at VIIPA places, for guests not staying yet (no kitchen names: each guest orders
 * from the kitchen where they stay). Every dish, once by name, dishes with photos first.
 */
export async function foodMenu(limit?: number): Promise<Dish[]> {
  const items = await db.menuItem.findMany({
    where: { available: true, restaurant: { status: "PUBLISHED", places: { some: {} } } },
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

export type PlaceOrderResult = { ok: true; reference: string; count: number } | { ok: false; error: "invalid" | "closed" | "notOffered" | "tooFar" | "noStay" | "cart" | "minOrder" | "notCustomer" };

/**
 * A guest orders from the menu of the place they are staying at. The dishes may come from several of the place's
 * restaurants: each restaurant gets its own order with only its dishes (the guest never picks a restaurant).
 */
export async function placeOrder(customerId: string, raw: OrderInput, now: Date = new Date()): Promise<PlaceOrderResult> {
  const parsed = orderInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const input = parsed.data;
  // Food is cooked for the place where the guest is staying and brought to their room: no pickup, no delivery elsewhere.
  if (input.fulfilment !== "TO_STAY") return { ok: false, error: "notOffered" };
  if (!(await isCustomer(customerId))) return { ok: false, error: "notCustomer" };
  const stay = await currentStay(customerId, input.bookingReference, now);
  if (!stay) return { ok: false, error: "noStay" };
  const kitchens = await kitchensForPlace(stay.listingId);
  if (kitchens.length === 0) {
    // Its kitchens are closed for now (rather than none cooking for the place).
    const closed = await db.restaurant.count({ where: { places: { some: { listingId: stay.listingId } }, status: "PUBLISHED", paused: true } });
    return { ok: false, error: closed > 0 ? "closed" : "tooFar" };
  }
  const cart = priceCart(input.lines, kitchens.flatMap((k) => k.menu));
  if (!cart) return { ok: false, error: "cart" };
  // One order per restaurant, each with its own dishes.
  const groups = kitchens.flatMap((k) => {
    const items = cart.items.filter((i) => k.menu.some((m) => m.id === i.menuItemId));
    return items.length > 0 ? [{ kitchen: k, items, subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0) }] : [];
  });
  if (cart.subtotal < Math.max(...groups.map((g) => g.kitchen.minOrder))) return { ok: false, error: "minOrder" };
  const address = [stay.listing.title, [stay.room?.name, stay.roomNumber].filter(Boolean).join(" "), stay.reference].filter(Boolean).join(" · ");

  for (let attempt = 0; attempt < 3; attempt++) {
    const references = groups.map(() => newReference("OR"));
    try {
      await db.$transaction(async (tx) => {
        for (const [i, { kitchen: r, items, subtotal }] of groups.entries()) {
          const reference = references[i]!;
          const order = await tx.foodOrder.create({
            data: {
              reference,
              restaurantId: r.id,
              customerId,
              fulfilment: input.fulfilment,
              address,
              bookingId: stay.id,
              phone: input.phone,
              note: input.note,
              subtotal,
              deliveryFee: 0,
              total: subtotal,
              // Paid after the restaurant confirms (mobile money, verified by VIIPA) and before the kitchen starts.
              paymentMethod: "PAY_FIRST",
              items: { create: items },
              events: { create: { to: "PLACED", actorId: customerId } },
            },
          });
          await audit(tx, { actorId: customerId, action: "order.place", entityType: "order", entityId: order.reference });
          for (const userId of new Set([r.ownerId, ...r.team.map((m) => m.userId)])) {
            await notify(tx, userId, "orderPlaced", { reference, title: r.name, total: order.total }, `/host/restaurants/${r.id}`);
          }
          // VIIPA staff see every new order (it waits for the guest's payment).
          await notifyAdmins(tx, "orderNew", { reference, title: address, total: order.total }, "/admin/orders");
        }
      });
      return { ok: true, reference: references[0]!, count: references.length };
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  return { ok: false, error: "invalid" };
}

/** Staff set which restaurants cook for a place (several are fine; a restaurant can cook for several places). Logged. */
export async function setPlaceKitchens(actor: Actor, listingId: string, restaurantIds: readonly string[]): Promise<boolean> {
  if (!canStaff(actor, "food") || !Array.isArray(restaurantIds) || restaurantIds.length > 30) return false;
  const ids = [...new Set(restaurantIds.filter((x) => typeof x === "string"))];
  return db.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({ where: { id: listingId }, select: { id: true } });
    if (!listing || (await tx.restaurant.count({ where: { id: { in: ids } } })) !== ids.length) return false;
    await tx.placeRestaurant.deleteMany({ where: { listingId, restaurantId: { notIn: ids } } });
    await tx.placeRestaurant.createMany({ data: ids.map((restaurantId) => ({ listingId, restaurantId, addedById: actor.id })), skipDuplicates: true });
    await audit(tx, { actorId: actor.id, action: "listing.kitchens", entityType: "listing", entityId: listingId, data: { restaurants: ids } });
    return true;
  });
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

export type ConfirmDeliveryResult = { ok: true; delivered: boolean } | { ok: false; error: "notFound" | "notAllowed" | "done" };

/** Who still has to confirm an order on its way: the guest; its delivery person; the place's receptionist (if any). */
export async function deliveryConfirmations(order: { courierId: string | null; bookingId: string | null; guestConfirmedAt: Date | null; courierConfirmedAt: Date | null; deskConfirmedAt: Date | null }) {
  const listingId = order.bookingId ? (await db.booking.findUnique({ where: { id: order.bookingId }, select: { listingId: true } }))?.listingId : null;
  const desk = listingId ? (await db.placeMember.count({ where: { listingId, role: "RECEPTIONIST" } })) > 0 : false;
  return {
    guest: { needed: true, done: Boolean(order.guestConfirmedAt) },
    courier: { needed: Boolean(order.courierId), done: Boolean(order.courierConfirmedAt) },
    desk: { needed: desk, done: Boolean(order.deskConfirmedAt) },
    listingId,
  };
}

/**
 * Someone confirms the food reached the guest: the guest ("I got it"), the delivery person who took it ("handed
 * over") or the receptionist of the place ("received at the desk"). Only they can: never the kitchen, the owner or
 * VIIPA staff. Once everyone needed has confirmed, the order is delivered (VIIPA and the guest are told).
 */
export async function confirmDelivery(actor: Actor, reference: string, now: Date = new Date()): Promise<ConfirmDeliveryResult> {
  const order = await db.foodOrder.findUnique({
    where: { reference },
    select: { id: true, status: true, customerId: true, courierId: true, bookingId: true, address: true, guestConfirmedAt: true, courierConfirmedAt: true, deskConfirmedAt: true, restaurant: { select: { name: true } } },
  });
  if (!order) return { ok: false, error: "notFound" };
  if (order.status !== "OUT_FOR_DELIVERY") return { ok: false, error: order.status === "DELIVERED" || order.status === "FINISHED" ? "done" : "notFound" };
  const need = await deliveryConfirmations(order);
  const asGuest = order.customerId === actor.id && !order.guestConfirmedAt;
  const asCourier = order.courierId === actor.id && !order.courierConfirmedAt;
  const asDesk = need.desk.needed && !order.deskConfirmedAt && Boolean(need.listingId) && (await db.placeMember.count({ where: { listingId: need.listingId!, userId: actor.id, role: "RECEPTIONIST" } })) > 0;
  if (!asGuest && !asCourier && !asDesk) return { ok: false, error: "notAllowed" };
  const data = { ...(asGuest ? { guestConfirmedAt: now } : {}), ...(asCourier ? { courierConfirmedAt: now } : {}), ...(asDesk ? { deskConfirmedAt: now, deskConfirmedById: actor.id } : {}) };
  const done = (need.guest.done || asGuest) && (!need.courier.needed || need.courier.done || asCourier) && (!need.desk.needed || need.desk.done || asDesk);
  return db.$transaction(async (tx) => {
    const { count } = await tx.foodOrder.updateMany({ where: { id: order.id, status: "OUT_FOR_DELIVERY" }, data: { ...data, ...(done ? { status: "DELIVERED" } : {}) } });
    if (count !== 1) return { ok: false, error: "notFound" } as const;
    const who = [asGuest && "guest", asCourier && "courier", asDesk && "desk"].filter(Boolean).join(",");
    await tx.orderEvent.create({ data: { orderId: order.id, from: "OUT_FOR_DELIVERY", to: done ? "DELIVERED" : "OUT_FOR_DELIVERY", actorId: actor.id, note: `confirmed by ${who}` } });
    await audit(tx, { actorId: actor.id, action: "order.confirm", entityType: "order", entityId: reference, data: { who, delivered: done } });
    if (done) {
      if (order.customerId !== actor.id) await notify(tx, order.customerId, "orderStatus", { reference, title: order.restaurant.name, status: "DELIVERED" }, `/orders/${reference}`);
      await notifyAdmins(tx, "orderReceived", { reference, title: order.address ?? order.restaurant.name }, "/admin/orders");
    }
    return { ok: true, delivered: done } as const;
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
    where: { checkOut: { gte: new Date(now.getTime() - 30 * 86_400_000) }, listing: { OR: [{ hostId: userId }, { team: { some: { userId, role: { in: ["MANAGER", "RECEPTIONIST"] } } } }] } },
    select: { id: true, reference: true, roomNumber: true, room: { select: { name: true } }, guest: { select: { name: true, phone: true } }, listing: { select: { id: true, title: true } } },
  });
  if (bookings.length === 0) return [];
  const byId = new Map(bookings.map((b) => [b.id, b]));
  const orders = await db.foodOrder.findMany({
    where: { bookingId: { in: [...byId.keys()] }, status: { in: [...HOST_ORDER_STATUSES] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { reference: true, status: true, createdAt: true, bookingId: true, note: true, courierId: true, guestConfirmedAt: true, courierConfirmedAt: true, deskConfirmedAt: true, items: { select: { name: true, quantity: true } }, events: { where: { to: "OUT_FOR_DELIVERY" }, select: { createdAt: true }, take: 1 } },
  });
  // Where they are the receptionist: they confirm the food that arrives there.
  const desk = new Set((await db.placeMember.findMany({ where: { userId, role: "RECEPTIONIST" }, select: { listingId: true } })).map((m) => m.listingId));
  const flagged = await withDesk(orders);
  return flagged.map(({ bookingId, events, hasDesk, ...o }) => {
    const stay = byId.get(bookingId!)!;
    return {
      ...o,
      sentAt: events[0]?.createdAt ?? null,
      stay,
      confirmations: confirmationsOf(o, hasDesk),
      canConfirm: o.status === "OUT_FOR_DELIVERY" && desk.has(stay.listing.id) && !o.deskConfirmedAt,
    };
  });
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
    select: { id: true, name: true, city: true, status: true, paused: true, owner: { select: { name: true } }, _count: { select: { menu: true, orders: true, placeRequests: { where: { status: "PENDING" } } } } },
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
    // Only once the restaurant has accepted: before that the guest has nothing to pay yet.
    where: { paidAt: null, status: "ACCEPTED", total: { gt: 0 } },
    orderBy: [{ paymentClaim: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take,
    select: { reference: true, total: true, paymentClaim: true, createdAt: true, address: true, phone: true, note: true, items: { select: { name: true, quantity: true } }, restaurant: { select: { name: true } }, customer: { select: { name: true } } },
  });
}

/** Staff: every kitchen's orders, newest first (open ones are picked out on the page). */
export async function allOrders(take = 150) {
  await expireOrders();
  const orders = await db.foodOrder.findMany({
    orderBy: [{ createdAt: "desc" }],
    take,
    include: {
      items: true,
      customer: { select: { name: true } },
      // Its delivery people (to assign a ready order).
      // Its delivery people (to assign a ready order), and who runs it (owner and managers: they process the order).
      restaurant: {
        select: {
          name: true,
          owner: { select: { name: true, phone: true } },
          team: { select: { userId: true, role: true, user: { select: { name: true, phone: true } } } },
        },
      },
    },
  });
  return withDesk(orders);
}

/** Where each order goes: the guest's place (address, official location, and a map link), for the delivery person. */
export async function withStayLocation<T extends { bookingId: string | null }>(orders: T[]): Promise<(T & { location: { title: string; address: string; mapUrl: string; room: { name: string; number: string | null } | null } | null })[]> {
  const bookingIds = [...new Set(orders.flatMap((o) => (o.bookingId ? [o.bookingId] : [])))];
  const rows =
    bookingIds.length === 0
      ? []
      : await db.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { id: true, roomNumber: true, room: { select: { name: true } }, listing: { select: { title: true, addressLine: true, village: true, cell: true, sector: true, district: true, lat: true, lng: true } } },
        });
  const byId = new Map(
    rows.map(({ id, listing: l, room, roomNumber }) => [
      id,
      {
        title: l.title,
        address: [l.addressLine, l.village, l.cell, l.sector, l.district].filter(Boolean).join(", "),
        mapUrl: `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`,
        // The exact room the guest is in (a room booking): its category and number.
        room: room ? { name: room.name, number: roomNumber } : null,
      },
    ]),
  );
  return orders.map((o) => ({ ...o, location: (o.bookingId && byId.get(o.bookingId)) || null }));
}

/**
 * Staff remind a restaurant's owner and managers about an order waiting for them (they may not have opened it).
 * At most once a minute per order. Logged.
 */
export async function remindRestaurant(actor: Actor, reference: string, now: Date = new Date()): Promise<{ ok: boolean; error?: string }> {
  if (!canStaff(actor, "food")) return { ok: false, error: "notAllowed" };
  const order = await db.foodOrder.findUnique({ where: { reference }, select: { status: true, total: true, restaurantId: true, restaurant: { select: { name: true, ownerId: true, team: { where: { role: { in: ["MANAGER", "STAFF"] } }, select: { userId: true } } } } } });
  if (!order || !["PLACED", "ACCEPTED", "PAID", "PREPARING", "READY"].includes(order.status)) return { ok: false, error: "notFound" };
  const recent = await db.auditLog.findFirst({ where: { action: "order.remind", entityId: reference, createdAt: { gt: new Date(now.getTime() - 60_000) } }, select: { id: true } });
  if (recent) return { ok: false, error: "tooSoon" };
  await db.$transaction(async (tx) => {
    for (const userId of new Set([order.restaurant.ownerId, ...order.restaurant.team.map((m) => m.userId)])) {
      await notify(tx, userId, "orderReminder", { reference, title: order.restaurant.name, total: order.total }, `/host/restaurants/${order.restaurantId}`);
    }
    await audit(tx, { actorId: actor.id, action: "order.remind", entityType: "order", entityId: reference });
  });
  return { ok: true };
}

/** Marks each order whose guest's place has a receptionist (who confirms the food arrived too). */
export async function withDesk<T extends { bookingId: string | null }>(orders: T[]): Promise<(T & { hasDesk: boolean })[]> {
  const bookingIds = [...new Set(orders.flatMap((o) => (o.bookingId ? [o.bookingId] : [])))];
  const desk = new Set(
    bookingIds.length === 0 ? [] : (await db.booking.findMany({ where: { id: { in: bookingIds }, listing: { team: { some: { role: "RECEPTIONIST" } } } }, select: { id: true } })).map((b) => b.id),
  );
  return orders.map((o) => ({ ...o, hasDesk: Boolean(o.bookingId && desk.has(o.bookingId)) }));
}

/** Who confirms an order on its way, and who has: the guest, its delivery person (if any), the receptionist (if any). */
export function confirmationsOf(o: { courierId: string | null; guestConfirmedAt: Date | null; courierConfirmedAt: Date | null; deskConfirmedAt: Date | null }, hasDesk: boolean) {
  return [
    { who: "guest" as const, done: Boolean(o.guestConfirmedAt) },
    ...(o.courierId ? [{ who: "courier" as const, done: Boolean(o.courierConfirmedAt) }] : []),
    ...(hasDesk ? [{ who: "desk" as const, done: Boolean(o.deskConfirmedAt) }] : []),
  ];
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
