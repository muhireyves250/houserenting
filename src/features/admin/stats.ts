import "server-only";
import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;
// Rwanda is UTC+2 all year.
const KIGALI_MS = 2 * 60 * 60 * 1000;

/** "YYYY-MM-DD" of an instant in Kigali. */
export const kigaliDay = (at: Date) => new Date(at.getTime() + KIGALI_MS).toISOString().slice(0, 10);

/** Start of the Kigali calendar month containing `at`, `offset` months away. */
function monthStart(at: Date, offset = 0): Date {
  const local = new Date(at.getTime() + KIGALI_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + offset, 1) - KIGALI_MS);
}

export type Kpi = { value: number; previous: number };

/** The overview: this month against last month, the last 30 days by day, and what needs a person. */
export async function dashboardStats(now: Date = new Date()) {
  const thisMonth = monthStart(now);
  const lastMonth = monthStart(now, -1);
  const firstDay = kigaliDay(new Date(now.getTime() - 29 * DAY_MS));
  const fromDay = new Date(`${firstDay}T00:00:00+02:00`);

  const inMonth = (from: Date, to: Date) => ({ gte: from, lt: to });
  const [
    bookingsNow,
    bookingsPrev,
    paidNow,
    paidPrev,
    commissionNow,
    commissionPrev,
    usersNow,
    usersPrev,
    liveListings,
    recentBookings,
    attention,
  ] = await Promise.all([
    db.booking.count({ where: { createdAt: inMonth(thisMonth, now) } }),
    db.booking.count({ where: { createdAt: inMonth(lastMonth, thisMonth) } }),
    db.ledgerEntry.aggregate({ where: { kind: "GUEST_PAYMENT", createdAt: inMonth(thisMonth, now) }, _sum: { amount: true } }),
    db.ledgerEntry.aggregate({ where: { kind: "GUEST_PAYMENT", createdAt: inMonth(lastMonth, thisMonth) }, _sum: { amount: true } }),
    db.ledgerEntry.aggregate({ where: { kind: { in: ["COMMISSION", "GUEST_FEE"] }, createdAt: inMonth(thisMonth, now) }, _sum: { amount: true } }),
    db.ledgerEntry.aggregate({ where: { kind: { in: ["COMMISSION", "GUEST_FEE"] }, createdAt: inMonth(lastMonth, thisMonth) }, _sum: { amount: true } }),
    db.user.count({ where: { createdAt: inMonth(thisMonth, now) } }),
    db.user.count({ where: { createdAt: inMonth(lastMonth, thisMonth) } }),
    db.listing.count({ where: { status: "PUBLISHED" } }),
    db.booking.findMany({ where: { createdAt: { gte: fromDay } }, select: { createdAt: true, status: true } }),
    attentionCounts(),
  ]);

  // Bookings made per day (Kigali days), every day present even when zero.
  const perDay = new Map<string, number>();
  for (let i = 0; i < 30; i++) perDay.set(kigaliDay(new Date(fromDay.getTime() + i * DAY_MS + KIGALI_MS)), 0);
  for (const b of recentBookings) {
    const day = kigaliDay(b.createdAt);
    if (perDay.has(day)) perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  return {
    kpis: {
      bookings: { value: bookingsNow, previous: bookingsPrev } satisfies Kpi,
      paid: { value: paidNow._sum.amount ?? 0, previous: paidPrev._sum.amount ?? 0 } satisfies Kpi,
      platform: { value: commissionNow._sum.amount ?? 0, previous: commissionPrev._sum.amount ?? 0 } satisfies Kpi,
      newUsers: { value: usersNow, previous: usersPrev } satisfies Kpi,
    },
    liveListings,
    bookingsPerDay: [...perDay.entries()].map(([day, count]) => ({ day, count })),
    attention,
  };
}

/** Everything waiting for staff, for the overview and the sidebar badges. */
export async function attentionCounts() {
  const [listings, questions, reviews, tickets, payments, rewards] = await Promise.all([
    db.listing.count({ where: { status: "PENDING_REVIEW" } }),
    db.listingQuestion.count({ where: { status: "PENDING" } }),
    db.review.count({ where: { status: "PENDING" } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.paymentEvent.count({ where: { outcome: { in: ["amountMismatch", "datesTaken", "notPending", "unknownBooking"] } } }),
    db.referralReward.count({ where: { status: "PENDING" } }),
  ]);
  return { listings, moderation: questions + reviews, tickets, payments, rewards };
}

export function latestBookings(take = 6) {
  return db.booking.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      reference: true,
      status: true,
      unit: true,
      quantity: true,
      total: true,
      createdAt: true,
      guest: { select: { name: true } },
      listing: { select: { id: true, title: true } },
    },
  });
}

export function allListings(status?: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED") {
  return db.listing.findMany({
    where: status ? { status } : { status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      city: true,
      district: true,
      updatedAt: true,
      host: { select: { name: true } },
      photos: { select: { url: true }, orderBy: { position: "asc" }, take: 1 },
    },
  });
}
