import "server-only";
import type { ListingStatus } from "@/generated/prisma/client";
import { cache } from "react";
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

  // The month-on-month numbers in one trip to the database; the last 30 days of bookings beside it.
  const [[k], recentBookings] = await Promise.all([
    db.$queryRaw<Record<string, bigint | null>[]>`
      SELECT
        (SELECT count(*) FROM "booking" WHERE "createdAt" >= ${thisMonth} AND "createdAt" < ${now}) AS "bookingsNow",
        (SELECT count(*) FROM "booking" WHERE "createdAt" >= ${lastMonth} AND "createdAt" < ${thisMonth}) AS "bookingsPrev",
        (SELECT sum("amount") FROM "ledgerEntry" WHERE "kind" = 'GUEST_PAYMENT' AND "createdAt" >= ${thisMonth} AND "createdAt" < ${now}) AS "paidNow",
        (SELECT sum("amount") FROM "ledgerEntry" WHERE "kind" = 'GUEST_PAYMENT' AND "createdAt" >= ${lastMonth} AND "createdAt" < ${thisMonth}) AS "paidPrev",
        (SELECT sum("amount") FROM "ledgerEntry" WHERE "kind" IN ('COMMISSION', 'GUEST_FEE') AND "createdAt" >= ${thisMonth} AND "createdAt" < ${now}) AS "platformNow",
        (SELECT sum("amount") FROM "ledgerEntry" WHERE "kind" IN ('COMMISSION', 'GUEST_FEE') AND "createdAt" >= ${lastMonth} AND "createdAt" < ${thisMonth}) AS "platformPrev",
        (SELECT count(*) FROM "user" WHERE "createdAt" >= ${thisMonth} AND "createdAt" < ${now}) AS "usersNow",
        (SELECT count(*) FROM "user" WHERE "createdAt" >= ${lastMonth} AND "createdAt" < ${thisMonth}) AS "usersPrev",
        (SELECT count(*) FROM "listing" WHERE "status" = 'PUBLISHED') AS "liveListings"
    `,
    db.booking.findMany({ where: { createdAt: { gte: fromDay } }, select: { createdAt: true, status: true } }),
  ]);
  const n = (key: string) => Number(k?.[key] ?? 0);

  // Bookings made per day (Kigali days), every day present even when zero.
  const perDay = new Map<string, number>();
  for (let i = 0; i < 30; i++) perDay.set(kigaliDay(new Date(fromDay.getTime() + i * DAY_MS + KIGALI_MS)), 0);
  for (const b of recentBookings) {
    const day = kigaliDay(b.createdAt);
    if (perDay.has(day)) perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  return {
    kpis: {
      bookings: { value: n("bookingsNow"), previous: n("bookingsPrev") } satisfies Kpi,
      paid: { value: n("paidNow"), previous: n("paidPrev") } satisfies Kpi,
      platform: { value: n("platformNow"), previous: n("platformPrev") } satisfies Kpi,
      newUsers: { value: n("usersNow"), previous: n("usersPrev") } satisfies Kpi,
    },
    liveListings: n("liveListings"),
    bookingsPerDay: [...perDay.entries()].map(([day, count]) => ({ day, count })),
  };
}

/** Everything waiting for staff, for the overview and the sidebar badges. */
export async function attentionCounts() {
  const [listings, questions, reviews, tickets, payments, rewards, requests, refunds] = await Promise.all([
    db.listing.count({ where: { status: "PENDING_REVIEW" } }),
    db.listingQuestion.count({ where: { status: "PENDING" } }),
    db.review.count({ where: { status: "PENDING" } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    db.paymentEvent.count({ where: { outcome: { in: ["amountMismatch", "datesTaken", "notPending", "unknownBooking"] } } }),
    db.referralReward.count({ where: { status: "PENDING" } }),
    db.stayRequest.count({ where: { status: "PENDING" } }),
    db.booking.count({ where: { refundStatus: "PENDING" } }),
  ]);
  return { listings, moderation: questions + reviews, tickets, payments, rewards, requests, refunds };
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

export function allListings(status?: ListingStatus) {
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

const DESK_SELECT = {
  reference: true,
  status: true,
  checkIn: true,
  checkOut: true,
  unit: true,
  quantity: true,
  roomNumber: true,
  room: { select: { name: true } },
  guest: { select: { name: true, phone: true } },
  listing: { select: { id: true, title: true } },
} as const;

/**
 * The front desk today (Kigali): paid guests due in (today or late, still before their last day), guests leaving
 * today, and guests whose stay has ended but who were never checked out.
 */
export async function frontDesk(now: Date = new Date()) {
  const today = new Date(`${kigaliDay(now)}T00:00:00Z`);
  const [arriving, leaving, overdue] = await Promise.all([
    db.booking.findMany({ where: { status: "CONFIRMED", checkIn: { lte: today }, checkOut: { gt: today } }, orderBy: { checkIn: "asc" }, take: 30, select: DESK_SELECT }),
    db.booking.findMany({ where: { status: "CHECKED_IN", checkOut: today }, orderBy: { checkIn: "asc" }, take: 30, select: DESK_SELECT }),
    db.booking.findMany({ where: { status: "CHECKED_IN", checkOut: { lt: today } }, orderBy: { checkOut: "asc" }, take: 30, select: DESK_SELECT }),
  ]);
  return { arriving, leaving, overdue };
}
export type DeskBooking = Awaited<ReturnType<typeof frontDesk>>["arriving"][number];

/**
 * Every number the staff sidebar and bell show, in one trip to the database (they are read on every staff page,
 * so this keeps pages quick). Same rules as attentionCounts, unreadCount, unreadChats, laundryToHandle and the
 * food orders waiting for staff. Shared by the layout and the page within one request.
 */
export const adminBadges = cache(async (staffId: string) => {
  const [row] = await db.$queryRaw<Record<string, bigint>[]>`
    SELECT
      (SELECT count(*) FROM "listing" WHERE "status" = 'PENDING_REVIEW') AS listings,
      (SELECT count(*) FROM "listingQuestion" WHERE "status" = 'PENDING')
        + (SELECT count(*) FROM "review" WHERE "status" = 'PENDING') AS moderation,
      (SELECT count(*) FROM "supportTicket" WHERE "status" IN ('OPEN', 'IN_PROGRESS')) AS tickets,
      (SELECT count(*) FROM "paymentEvent" WHERE "outcome" IN ('amountMismatch', 'datesTaken', 'notPending', 'unknownBooking')) AS payments,
      (SELECT count(*) FROM "referralReward" WHERE "status" = 'PENDING') AS rewards,
      (SELECT count(*) FROM "stayRequest" WHERE "status" = 'PENDING') AS requests,
      (SELECT count(*) FROM "booking" WHERE "refundStatus" = 'PENDING') AS refunds,
      (SELECT count(*) FROM "notification" WHERE "userId" = ${staffId} AND "readAt" IS NULL) AS unread,
      (SELECT count(*) FROM "laundryOrder"
        WHERE "status" IN ('REQUESTED', 'PICKED_UP', 'WASHED')
           OR ("paymentClaim" IS NOT NULL AND "paidAt" IS NULL AND "status" <> 'CANCELLED')) AS laundry,
      (SELECT count(*) FROM "foodOrder"
        WHERE ("paymentMethod" = 'PAY_FIRST' AND "paidAt" IS NULL AND "status" = 'PLACED' AND "paymentClaim" IS NOT NULL)
           OR "status" IN ('ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY')
           OR ("status" = 'PLACED' AND ("paymentMethod" = 'ON_DELIVERY' OR "paidAt" IS NOT NULL))) AS orders,
      (SELECT count(*) FROM (
        SELECT c."guestId", c."hostReadAt", last."senderId", last."createdAt"
        FROM (SELECT * FROM "conversation" ORDER BY "lastMessageAt" DESC LIMIT 200) c
        CROSS JOIN LATERAL (
          SELECT m."senderId", m."createdAt" FROM "message" m WHERE m."conversationId" = c."id" ORDER BY m."createdAt" DESC LIMIT 1
        ) last
      ) chats WHERE chats."senderId" = chats."guestId" AND (chats."hostReadAt" IS NULL OR chats."hostReadAt" < chats."createdAt")) AS messages
  `;
  const n = (key: string) => Number(row?.[key] ?? 0);
  return {
    listings: n("listings"),
    moderation: n("moderation"),
    tickets: n("tickets"),
    payments: n("payments"),
    rewards: n("rewards"),
    requests: n("requests"),
    refunds: n("refunds"),
    unread: n("unread"),
    laundry: n("laundry"),
    orders: n("orders"),
    messages: n("messages"),
  };
});
