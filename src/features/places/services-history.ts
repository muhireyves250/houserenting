import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/** Food orders with their money and every step (who and when): delivery person, receptionist, guest confirming. */
export async function foodHistories(where: Prisma.FoodOrderWhereInput, take = 30) {
  const food = await db.foodOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      reference: true,
      status: true,
      total: true,
      paidAt: true,
      createdAt: true,
      courierId: true,
      cancelReason: true,
      address: true,
      guestConfirmedAt: true,
      courierConfirmedAt: true,
      deskConfirmedAt: true,
      deskConfirmedById: true,
      restaurant: { select: { name: true } },
      customer: { select: { name: true } },
      items: { select: { name: true, quantity: true } },
      events: { orderBy: { createdAt: "asc" }, select: { to: true, actorId: true, note: true, createdAt: true } },
    },
  });
  const ledger = food.length ? await db.ledgerEntry.findMany({ where: { note: { in: food.map((o) => `food ${o.reference}`) }, kind: { in: ["COMMISSION", "HOST_PAYABLE"] } }, select: { kind: true, amount: true, note: true } }) : [];
  // Everyone named: who did each step, the delivery person given the order (the step's note keeps their id), the desk.
  const ids = [...new Set(food.flatMap((o) => [...o.events.flatMap((e) => [e.actorId, e.to === "COURIER_ASSIGNED" ? e.note : null]), o.courierId, o.deskConfirmedById]).filter((x): x is string => Boolean(x)))];
  const names = new Map((ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []).map((u) => [u.id, u.name]));
  const who = (id: string | null | undefined) => (id ? (names.get(id) ?? null) : null);
  const sum = (ref: string, kind: string) => ledger.filter((e) => e.note === `food ${ref}` && e.kind === kind).reduce((n, e) => n + e.amount, 0);
  return food.map((o) => ({
    reference: o.reference,
    status: o.status,
    restaurant: o.restaurant.name,
    guest: o.customer.name,
    address: o.address,
    createdAt: o.createdAt,
    cancelReason: o.cancelReason,
    items: o.items,
    total: o.total,
    commission: sum(o.reference, "COMMISSION"),
    share: sum(o.reference, "HOST_PAYABLE"),
    paidAt: o.paidAt,
    courier: who(o.courierId),
    confirmed: { guest: o.guestConfirmedAt, courier: o.courierConfirmedAt, desk: o.deskConfirmedAt, deskBy: who(o.deskConfirmedById) },
    // Each step as it happened; a failed delivery (back to ready) and the confirmations are told apart by their note.
    steps: o.events.map((e, i): Step => {
      const from = i > 0 ? o.events[i - 1]!.to : null;
      const what = e.note?.startsWith("confirmed by ") ? `CONFIRMED:${e.note.replace("confirmed by ", "")}` : e.to === "READY" && from === "OUT_FOR_DELIVERY" ? "DELIVERY_FAILED" : e.to;
      const note = e.to === "COURIER_ASSIGNED" ? who(e.note) : e.note?.startsWith("confirmed by ") ? null : e.note?.replace(/^delivery failed: /, "") ?? null;
      return { at: e.createdAt, what, who: who(e.actorId), note };
    }),
  }));
}
export type FoodHistory = Awaited<ReturnType<typeof foodHistories>>[number];



export type Step = { at: Date; what: string; who: string | null; note: string | null };

/**
 * The food and laundry at one place, for staff: each order with its money and every step — who did it and when
 * (restaurant accepted, delivery person, receptionist, guest confirming; laundry collected, washed, returned, received).
 */
export async function placeServices(listingId: string, take = 30) {
  const bookings = await db.booking.findMany({ where: { listingId }, select: { id: true } });
  const [food, laundry] = await Promise.all([
    bookings.length ? foodHistories({ bookingId: { in: bookings.map((b) => b.id) } }, take) : [],
    db.laundryOrder.findMany({
      where: { listingId },
      orderBy: { createdAt: "desc" },
      take,
      select: { reference: true, status: true, weightGrams: true, amount: true, paidAt: true, createdAt: true, booking: { select: { guest: { select: { name: true } } } } },
    }),
  ]);
  const laundryLog = laundry.length ? await db.auditLog.findMany({ where: { entityType: "laundry", entityId: { in: laundry.map((l) => l.reference) } }, orderBy: { createdAt: "asc" }, select: { action: true, actorId: true, entityId: true, createdAt: true, data: true } }) : [];
  const ids = [...new Set(laundryLog.map((l) => l.actorId).filter((x): x is string => Boolean(x)))];
  const names = new Map((ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []).map((u) => [u.id, u.name]));
  return {
    food,
    laundry: laundry.map((l) => ({
      reference: l.reference,
      status: l.status,
      guest: l.booking.guest.name,
      kg: l.weightGrams !== null ? l.weightGrams / 1000 : null,
      amount: l.amount,
      paidAt: l.paidAt,
      steps: laundryLog
        .filter((a) => a.entityId === l.reference)
        .map((a): Step => ({ at: a.createdAt, what: a.action.replace("laundry.", ""), who: a.actorId ? (names.get(a.actorId) ?? null) : null, note: (a.data as { reason?: string } | null)?.reason ?? null })),
    })),
  };
}
