import "server-only";
import { db } from "@/lib/db";

export type Step = { at: Date; what: string; who: string | null; note: string | null };

/**
 * The food and laundry at one place, for staff: each order with its money and every step — who did it and when
 * (restaurant accepted, delivery person, receptionist, guest confirming; laundry collected, washed, returned, received).
 */
export async function placeServices(listingId: string, take = 30) {
  const bookings = await db.booking.findMany({ where: { listingId }, select: { id: true } });
  const bookingIds = bookings.map((b) => b.id);
  const [food, laundry] = await Promise.all([
    bookingIds.length
      ? db.foodOrder.findMany({
          where: { bookingId: { in: bookingIds } },
          orderBy: { createdAt: "desc" },
          take,
          select: {
            reference: true,
            status: true,
            total: true,
            paidAt: true,
            createdAt: true,
            courierId: true,
            guestConfirmedAt: true,
            courierConfirmedAt: true,
            deskConfirmedAt: true,
            deskConfirmedById: true,
            restaurant: { select: { name: true } },
            customer: { select: { name: true } },
            items: { select: { name: true, quantity: true } },
            events: { orderBy: { createdAt: "asc" }, select: { to: true, actorId: true, note: true, createdAt: true } },
          },
        })
      : [],
    db.laundryOrder.findMany({
      where: { listingId },
      orderBy: { createdAt: "desc" },
      take,
      select: { reference: true, status: true, weightGrams: true, amount: true, paidAt: true, createdAt: true, guestId: true, booking: { select: { guest: { select: { name: true } } } } },
    }),
  ]);
  const [ledger, laundryLog] = await Promise.all([
    food.length ? db.ledgerEntry.findMany({ where: { note: { in: food.map((o) => `food ${o.reference}`) }, kind: { in: ["COMMISSION", "HOST_PAYABLE"] } }, select: { kind: true, amount: true, note: true } }) : [],
    laundry.length ? db.auditLog.findMany({ where: { entityType: "laundry", entityId: { in: laundry.map((l) => l.reference) } }, orderBy: { createdAt: "asc" }, select: { action: true, actorId: true, entityId: true, createdAt: true, data: true } }) : [],
  ]);
  // Everyone named in the steps.
  const ids = [...new Set([...food.flatMap((o) => [...o.events.map((e) => e.actorId), o.courierId, o.deskConfirmedById]), ...laundryLog.map((l) => l.actorId)].filter((x): x is string => Boolean(x)))];
  const names = new Map((ids.length ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []).map((u) => [u.id, u.name]));
  const who = (id: string | null | undefined) => (id ? (names.get(id) ?? null) : null);
  const sum = (ref: string, kind: string) => ledger.filter((e) => e.note === `food ${ref}` && e.kind === kind).reduce((n, e) => n + e.amount, 0);

  return {
    food: food.map((o) => ({
      reference: o.reference,
      status: o.status,
      restaurant: o.restaurant.name,
      guest: o.customer.name,
      items: o.items,
      total: o.total,
      commission: sum(o.reference, "COMMISSION"),
      share: sum(o.reference, "HOST_PAYABLE"),
      paidAt: o.paidAt,
      courier: who(o.courierId),
      confirmed: { guest: o.guestConfirmedAt, courier: o.courierConfirmedAt, desk: o.deskConfirmedAt, deskBy: who(o.deskConfirmedById) },
      steps: o.events.map((e): Step => ({ at: e.createdAt, what: e.to, who: who(e.actorId), note: e.note })),
    })),
    laundry: laundry.map((l) => ({
      reference: l.reference,
      status: l.status,
      guest: l.booking.guest.name,
      kg: l.weightGrams !== null ? l.weightGrams / 1000 : null,
      amount: l.amount,
      paidAt: l.paidAt,
      steps: laundryLog
        .filter((a) => a.entityId === l.reference)
        .map((a): Step => ({ at: a.createdAt, what: a.action.replace("laundry.", ""), who: who(a.actorId), note: (a.data as { reason?: string } | null)?.reason ?? null })),
    })),
  };
}
