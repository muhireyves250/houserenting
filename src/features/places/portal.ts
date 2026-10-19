import "server-only";
import { todayISO } from "@/features/search/date-range";
import { db } from "@/lib/db";
import type { PlaceRole } from "./access";
import { placesRunBy } from "./access";

/**
 * Bookings across every place someone owns or helps run: arriving or staying now first, then upcoming,
 * then the last 30 days. Each row says the person's role on that place, to show only what they may do.
 */
export async function portalBookings(userId: string, now: Date = new Date()) {
  const { owned, member } = await placesRunBy(userId);
  const roles = new Map<string, PlaceRole>([...owned.map((id) => [id, "owner"] as const), ...member.map((m) => [m.listingId, m.role === "MANAGER" ? "manager" : "receptionist"] as const)]);
  if (roles.size === 0) return { rows: [], places: 0 };
  const since = new Date(`${todayISO(now)}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 30);
  const rows = await db.booking.findMany({
    where: { listingId: { in: [...roles.keys()] }, status: { in: ["CONFIRMED", "CHECKED_IN", "PENDING_PAYMENT", "COMPLETED", "NO_SHOW", "CANCELLED"] }, checkOut: { gte: since } },
    orderBy: [{ checkIn: "asc" }],
    take: 200,
    select: {
      reference: true,
      status: true,
      checkIn: true,
      checkOut: true,
      guests: true,
      total: true,
      listingId: true,
      room: { select: { name: true } },
      guest: { select: { name: true, phone: true } },
      listing: { select: { title: true } },
      guestDocument: { select: { filename: true } },
      payments: { where: { status: "PENDING", provider: "manual" }, select: { providerReference: true }, take: 1 },
      requests: { where: { status: "PENDING" }, select: { id: true, kind: true, reason: true, newCheckOut: true, transferTo: true } },
    },
  });
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { rows: rows.map((r) => ({ ...r, checkIn: iso(r.checkIn), checkOut: iso(r.checkOut), role: roles.get(r.listingId)! })), places: roles.size };
}
