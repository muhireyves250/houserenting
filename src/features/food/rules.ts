export const ORDER_STATUSES = ["PLACED", "ACCEPTED", "PAID", "PREPARING", "READY", "COURIER_ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "FINISHED", "REJECTED", "TIMED_OUT", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type Fulfilment = "PICKUP" | "DELIVERY" | "TO_STAY";
/** Who moves an order: the restaurant's kitchen (owner, manager, staff, VIIPA), its delivery people, or the customer. */
export type OrderActor = "kitchen" | "courier" | "customer";

/** The restaurant has this long to accept or reject a new order; after that it times out (nothing is charged). */
export const ACCEPT_MINUTES = 5;
export const acceptDeadline = (placedAt: Date) => new Date(placedAt.getTime() + ACCEPT_MINUTES * 60_000);

/**
 * The order's next steps for this person (requirements 3.5): the restaurant confirms or rejects → the customer pays
 * (VIIPA verifies: PAID) → the kitchen prepares → ready → a delivery person is assigned → collected → delivered (or it
 * failed and goes back to ready) → the customer's feedback finishes it. The restaurant is responsible for delivery, so
 * its kitchen can also do the delivery steps. Customers cancel only before paying.
 */
export function nextOrderSteps(status: OrderStatus, _fulfilment: Fulfilment, actor: OrderActor, paid = false): OrderStatus[] {
  if (actor === "customer") {
    if (status === "PLACED" || (status === "ACCEPTED" && !paid)) return ["CANCELLED"];
    if (status === "OUT_FOR_DELIVERY") return ["DELIVERED"];
    return [];
  }
  const courier: OrderStatus[] = status === "COURIER_ASSIGNED" ? ["OUT_FOR_DELIVERY"] : status === "OUT_FOR_DELIVERY" ? ["DELIVERED", "READY"] : [];
  if (actor === "courier") return courier;
  switch (status) {
    case "PLACED":
      return ["ACCEPTED", "REJECTED"];
    case "ACCEPTED":
      // Older orders were paid before acceptance: they go straight on to the kitchen.
      return paid ? ["PREPARING"] : ["CANCELLED"];
    case "PAID":
      return ["PREPARING"];
    case "PREPARING":
      return ["READY"];
    case "READY":
      return ["COURIER_ASSIGNED"];
    default:
      return courier;
  }
}

/** Still in progress (shown as current to the customer and the restaurant). */
export const ACTIVE_ORDER: readonly OrderStatus[] = ["PLACED", "ACCEPTED", "PAID", "PREPARING", "READY", "COURIER_ASSIGNED", "OUT_FOR_DELIVERY"];
/** Ended without food: nothing is charged (or it is refunded). */
export const CLOSED_UNSERVED: readonly OrderStatus[] = ["REJECTED", "TIMED_OUT", "CANCELLED"];

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type CartLine = { menuItemId: string; quantity: number };
export const MAX_QUANTITY = 50;
export const MAX_LINES = 40;

/** Cart lines checked against the menu: known, available, sensible quantities; prices always from the menu. */
export function priceCart(lines: CartLine[], menu: { id: string; name: string; price: number; available: boolean }[]) {
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > MAX_LINES) return null;
  const byId = new Map(menu.map((m) => [m.id, m]));
  const items: { menuItemId: string; name: string; price: number; quantity: number }[] = [];
  for (const line of lines) {
    const item = byId.get(line.menuItemId);
    if (!item || !item.available || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) return null;
    const same = items.find((i) => i.menuItemId === item.id);
    if (same) same.quantity = Math.min(MAX_QUANTITY, same.quantity + line.quantity);
    else items.push({ menuItemId: item.id, name: item.name, price: item.price, quantity: line.quantity });
  }
  return { items, subtotal: items.reduce((sum, i) => sum + i.price * i.quantity, 0) };
}
