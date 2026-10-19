import "server-only";
import { toCsv } from "@/features/admin/queries";
import { readSettings } from "@/features/settings/service";
import { db } from "@/lib/db";
import { aggregate, type Granularity, type ReportBooking } from "./aggregate";

export type ReportFilter = { from: string; to: string; by: Granularity; listingId?: string; ownerId?: string; type?: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const GRANULARITIES: Granularity[] = ["day", "week", "month", "year"];

/** Report filters from the page's query: last 30 days by default, at most 2 years at once. */
export function readFilter(q: Record<string, string | undefined>, now: Date = new Date()): ReportFilter {
  const today = now.toISOString().slice(0, 10);
  const monthAgo = new Date(now.getTime() - 29 * 86_400_000).toISOString().slice(0, 10);
  let from = q.from && DAY.test(q.from) ? q.from : monthAgo;
  const to = q.to && DAY.test(q.to) ? q.to : today;
  if (from > to) from = to;
  if (Date.parse(to) - Date.parse(from) > 731 * 86_400_000) from = new Date(Date.parse(to) - 731 * 86_400_000).toISOString().slice(0, 10);
  const by = GRANULARITIES.includes(q.by as Granularity) ? (q.by as Granularity) : "day";
  return { from, to, by, listingId: q.place || undefined, ownerId: q.owner || undefined, type: q.type || undefined };
}

/** Bookings that count as business (paid stays, including no-shows) by stay date, with refunds, and food orders. */
export async function buildReport(f: ReportFilter) {
  const [rows, settings, orders] = await Promise.all([
    db.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN", "COMPLETED", "NO_SHOW", "CANCELLED"] },
        checkIn: { gte: new Date(`${f.from}T00:00:00Z`), lte: new Date(`${f.to}T00:00:00Z`) },
        ...(f.listingId ? { listingId: f.listingId } : {}),
        listing: { ...(f.ownerId ? { hostId: f.ownerId } : {}), ...(f.type ? { type: f.type as never } : {}) },
      },
      take: 20_000,
      select: {
        reference: true,
        status: true,
        checkIn: true,
        nights: true,
        total: true,
        guestFee: true,
        commission: true,
        hostPayout: true,
        discount: true,
        deposit: true,
        refundStatus: true,
        refundAmount: true,
        payments: { where: { status: "SUCCEEDED" }, select: { id: true }, take: 1 },
        listing: { select: { id: true, title: true, type: true, hostId: true, host: { select: { name: true } } } },
      },
    }),
    readSettings(),
    db.foodOrder.groupBy({
      by: ["restaurantId"],
      where: { status: "DELIVERED", createdAt: { gte: new Date(`${f.from}T00:00:00Z`), lt: new Date(Date.parse(`${f.to}T00:00:00Z`) + 86_400_000) } },
      _sum: { total: true, deliveryFee: true },
      _count: true,
    }),
  ]);
  // Cancelled bookings only matter for the refunds they caused; everything else is business that happened.
  const bookings: ReportBooking[] = rows
    .filter((r) => r.status !== "CANCELLED" || (r.refundStatus === "REFUNDED" && r.payments.length > 0))
    .map((r) => {
      const cancelled = r.status === "CANCELLED";
      return {
        reference: r.reference,
        checkIn: r.checkIn.toISOString().slice(0, 10),
        nights: cancelled ? 0 : r.nights,
        total: r.total,
        guestFee: r.guestFee,
        commission: r.commission,
        hostPayout: r.hostPayout,
        discount: r.discount,
        deposit: r.deposit,
        refunded: r.refundStatus === "REFUNDED" ? (r.refundAmount ?? 0) : 0,
        placeId: r.listing.id,
        place: r.listing.title,
        type: r.listing.type,
        ownerId: r.listing.hostId,
        owner: r.listing.host.name,
      };
    });
  const restaurants = orders.length ? await db.restaurant.findMany({ where: { id: { in: orders.map((o) => o.restaurantId) } }, select: { id: true, name: true } }) : [];
  const names = new Map(restaurants.map((r) => [r.id, r.name]));
  return {
    filter: f,
    report: aggregate(bookings, { by: f.by, from: f.from, to: f.to, vatBps: settings.vatBps, citBps: settings.citBps }),
    rates: { vatBps: settings.vatBps, citBps: settings.citBps },
    orders: orders.map((o) => ({ restaurant: names.get(o.restaurantId) ?? o.restaurantId, orders: o._count, total: o._sum.total ?? 0, delivery: o._sum.deliveryFee ?? 0 })).sort((a, b) => b.total - a.total),
    bookings,
  };
}

/** The same report as rows for Excel: every booking with its money, then the totals. */
export async function reportCsv(f: ReportFilter): Promise<string> {
  const { report, bookings } = await buildReport(f);
  const rows: unknown[][] = bookings.map((b) => [b.reference, b.checkIn, b.place, b.type, b.owner, b.nights, b.total - b.deposit, b.guestFee, b.commission, b.hostPayout, b.total - b.deposit - b.hostPayout, b.refunded]);
  const t = report.totals;
  rows.push(["TOTAL", `${f.from} → ${f.to}`, "", "", "", t.nights, t.gross, t.guestFees, t.commission, t.hostPayout, t.platform, t.refunds]);
  return toCsv(["reference", "stay_date", "place", "category", "owner", "nights", "gross_rwf", "guest_fees_rwf", "commission_rwf", "owner_payout_rwf", "platform_rwf", "refunds_rwf"], rows);
}

export function reportChoices() {
  return Promise.all([
    db.listing.findMany({ where: { status: { not: "DRAFT" } }, select: { id: true, title: true }, orderBy: { title: "asc" }, take: 500 }),
    db.user.findMany({ where: { listings: { some: {} } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);
}
