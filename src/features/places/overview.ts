import "server-only";
import { db } from "@/lib/db";

export type RoomNow = { category: string; number: string | null; state: "free" | "occupied" | "MAINTENANCE" | "CLEANING" | "UNAVAILABLE" | "blocked"; guest?: string; until?: Date };

/**
 * One place at a glance for staff: who is staying now (or free), the next booking, every room's state today
 * (guest houses), and the work still open on it (payments to confirm, guest requests, laundry, food, changes to
 * approve, restaurant applications, closed dates, missing agreement or payout check).
 */
export async function placeOverview(listingId: string, now: Date = new Date()) {
  const [listing, live, next, rooms, blocks, claims, requests, laundry, food, kitchenRequests, agreement] = await Promise.all([
    db.listing.findUnique({ where: { id: listingId }, select: { hostId: true, pendingChanges: true, operator: true, _count: { select: { photos: true } } } }),
    // Paid stays under way now.
    db.booking.findMany({ where: { listingId, status: { in: ["CONFIRMED", "CHECKED_IN"] }, startAt: { lte: now }, endAt: { gt: now } }, select: { roomId: true, roomNumber: true, endAt: true, status: true, guest: { select: { name: true } } } }),
    db.booking.findFirst({ where: { listingId, status: { in: ["CONFIRMED", "PENDING_PAYMENT"] }, startAt: { gt: now } }, orderBy: { startAt: "asc" }, select: { reference: true, startAt: true, guest: { select: { name: true } } } }),
    db.room.findMany({ where: { listingId }, orderBy: { position: "asc" }, select: { id: true, name: true, numbers: true, status: true } }),
    db.availabilityBlock.findMany({ where: { listingId, endedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, select: { roomId: true, kind: true } }),
    db.booking.count({ where: { listingId, status: "PENDING_PAYMENT", payments: { some: { status: "PENDING" } } } }),
    db.stayRequest.count({ where: { status: "PENDING", booking: { listingId } } }),
    db.laundryOrder.count({ where: { listingId, status: { in: ["REQUESTED", "ACCEPTED", "PICKED_UP", "WASHED", "RETURNED"] } } }),
    // Food on its way or being made for guests staying here (orders keep only their booking's id).
    db.booking
      .findMany({ where: { listingId, endAt: { gt: new Date(now.getTime() - 2 * 86_400_000) } }, select: { id: true } })
      .then((b) => (b.length ? db.foodOrder.count({ where: { bookingId: { in: b.map((x) => x.id) }, status: { in: ["PLACED", "ACCEPTED", "PAID", "PREPARING", "READY", "COURIER_ASSIGNED", "OUT_FOR_DELIVERY"] } } }) : 0)),
    db.kitchenRequest.count({ where: { listingId, status: "PENDING" } }),
    db.commissionAgreement.findFirst({ where: { subject: "PLACE", subjectId: listingId }, select: { id: true } }),
  ]);
  const payout = listing ? await db.payoutAccount.findUnique({ where: { userId: listing.hostId }, select: { verifiedAt: true } }) : null;
  const wholeBlocked = blocks.some((b) => b.roomId === null);

  // Each room today: a guest in it, closed (status or a block), or free.
  const roomsNow: RoomNow[] = rooms.flatMap((r) => {
    const units = r.numbers.length ? r.numbers : [null];
    return units.map((n): RoomNow => {
      const stay = live.find((b) => b.roomId === null || (b.roomId === r.id && (n === null || b.roomNumber === n)));
      if (stay) return { category: r.name, number: n, state: "occupied", guest: stay.guest.name, until: stay.endAt };
      if (r.status !== "AVAILABLE") return { category: r.name, number: n, state: r.status };
      if (wholeBlocked || blocks.some((b) => b.roomId === r.id)) return { category: r.name, number: n, state: "blocked" };
      return { category: r.name, number: n, state: "free" };
    });
  });

  const tasks = [
    { key: "claims", count: claims, href: "#bookings" },
    { key: "requests", count: requests, href: "/admin/requests" },
    { key: "laundry", count: laundry, href: "/admin/laundry" },
    { key: "food", count: food, href: "/admin/orders" },
    { key: "changes", count: listing?.pendingChanges ? 1 : 0, href: "#top" },
    { key: "kitchens", count: kitchenRequests, href: "#kitchens" },
    { key: "blocks", count: blocks.length, href: "#blocks" },
    { key: "noAgreement", count: agreement ? 0 : 1, href: "#agreement" },
    { key: "payout", count: listing?.operator === "OWNER" && !payout?.verifiedAt ? 1 : 0, href: "#payout" },
    { key: "photos", count: listing?._count.photos ? 0 : 1, href: "#photos" },
  ].filter((t) => t.count > 0);

  return { now: live.find((b) => b.roomId === null) ?? (rooms.length === 0 ? live[0] : undefined) ?? null, staying: live.length, next, rooms: roomsNow, tasks };
}
