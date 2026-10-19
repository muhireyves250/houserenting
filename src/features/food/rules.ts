export const ORDER_STATUSES = ["PLACED", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type Fulfilment = "PICKUP" | "DELIVERY" | "TO_STAY";
/** Who moves an order: the restaurant's kitchen (owner, manager, staff), its couriers, or the customer. */
export type OrderActor = "kitchen" | "courier" | "customer";

const KITCHEN: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PLACED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
};

/**
 * The order's next steps for this person. Pickups and room orders are handed over by the kitchen (READY → DELIVERED);
 * deliveries go out with a courier. Customers can only cancel before the restaurant accepts.
 */
export function nextOrderSteps(status: OrderStatus, fulfilment: Fulfilment, actor: OrderActor): OrderStatus[] {
  if (actor === "customer") return status === "PLACED" ? ["CANCELLED"] : [];
  if (actor === "kitchen") {
    if (status === "READY") return fulfilment === "DELIVERY" ? ["OUT_FOR_DELIVERY"] : ["DELIVERED"];
    return KITCHEN[status] ?? [];
  }
  // Couriers take ready deliveries out and hand them over.
  if (fulfilment !== "DELIVERY") return [];
  if (status === "READY") return ["OUT_FOR_DELIVERY"];
  if (status === "OUT_FOR_DELIVERY") return ["DELIVERED"];
  return [];
}

export const ACTIVE_ORDER: readonly OrderStatus[] = ["PLACED", "ACCEPTED", "PREPARING", "READY", "OUT_FOR_DELIVERY"];

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
