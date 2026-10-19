import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/features/audit/service";
import { notify } from "@/features/notifications/service";
import { db } from "@/lib/db";

export const PAGE_SIZE = 25;
const pageOf = (page: number) => ({ skip: (Math.max(1, page) - 1) * PAGE_SIZE, take: PAGE_SIZE });
const like = (q: string) => ({ contains: q.replace(/[\\%_]/g, (c) => `\\${c}`), mode: "insensitive" as const });

export const BOOKING_STATUSES = ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED", "EXPIRED", "NO_SHOW"] as const;
export type BookingStatusFilter = (typeof BOOKING_STATUSES)[number];

function bookingWhere(status?: BookingStatusFilter, q?: string): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {};
  if (status) where.status = status;
  const query = q?.trim();
  if (query) {
    where.OR = [
      { reference: { contains: query.toUpperCase() } },
      { guest: { name: like(query) } },
      { guest: { email: like(query) } },
      { listing: { title: like(query) } },
    ];
  }
  return where;
}

const BOOKING_ROW = {
  reference: true,
  status: true,
  unit: true,
  quantity: true,
  checkIn: true,
  checkOut: true,
  startAt: true,
  total: true,
  commission: true,
  hostPayout: true,
  createdAt: true,
  room: { select: { name: true } },
  guest: { select: { id: true, name: true, email: true } },
  listing: { select: { id: true, title: true } },
} satisfies Prisma.BookingSelect;

/** Bookings for the staff table: filter by status, search reference / guest / place; newest first. */
export async function searchBookings({ status, q, page = 1 }: { status?: BookingStatusFilter; q?: string; page?: number }) {
  const where = bookingWhere(status, q);
  const [rows, total, counts] = await Promise.all([
    db.booking.findMany({ where, orderBy: { createdAt: "desc" }, ...pageOf(page), select: BOOKING_ROW }),
    db.booking.count({ where }),
    db.booking.groupBy({ by: ["status"], where: bookingWhere(undefined, q), _count: true }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) as Partial<Record<BookingStatusFilter, number>> };
}

/** Everything about one booking, for staff. Identity details (long stays) only ever leave the database here. */
export function bookingForStaff(reference: string) {
  return db.booking.findUnique({
    where: { reference },
    include: {
      listing: { select: { id: true, title: true, city: true, district: true, host: { select: { id: true, name: true, email: true, phone: true } } } },
      guest: { select: { id: true, name: true, email: true, phone: true } },
      room: { select: { name: true } },
      promoCode: { select: { code: true, fundedBy: true } },
      identity: true,
      payments: { orderBy: { createdAt: "asc" } },
      ledger: { orderBy: { createdAt: "asc" } },
      review: { select: { rating: true, comment: true, status: true } },
      events: { orderBy: { createdAt: "asc" } },
      requests: { orderBy: { createdAt: "desc" } },
      feedback: { select: { liked: true, comment: true } },
      guestDocument: { select: { filename: true, createdAt: true } },
    },
  });
}

/** Names of the people who changed a booking (events keep only the actor's id). */
export async function actorNames(ids: (string | null)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const users = await db.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(users.map((u) => [u.id, u.name]));
}

/** Staff release an unpaid hold (paid bookings follow the refund policy, not this). Logged with the reason. */
export async function staffCancelUnpaid(staffId: string, reference: string, reason: string): Promise<boolean> {
  const why = reason.trim().slice(0, 300);
  if (!why) return false;
  return db.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { reference }, select: { id: true, status: true, guestId: true, listing: { select: { title: true } } } });
    if (!booking || booking.status !== "PENDING_PAYMENT") return false;
    const { count } = await tx.booking.updateMany({ where: { id: booking.id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
    if (count !== 1) return false;
    await tx.bookingEvent.create({ data: { bookingId: booking.id, fromStatus: "PENDING_PAYMENT", toStatus: "CANCELLED", actorId: staffId, reason: why } });
    await audit(tx, { actorId: staffId, action: "booking.cancel", entityType: "booking", entityId: reference, data: { reason: why } });
    await notify(tx, booking.guestId, "bookingCancelled", { title: booking.listing.title, reference }, `/bookings/${reference}`);
    return true;
  });
}

export type UserFilter = "all" | "staff" | "hosts" | "suspended";

function userWhere(filter: UserFilter, q?: string): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput =
    filter === "staff" ? { role: { in: ["ADMIN" as const, "SUPER_ADMIN" as const] } } : filter === "hosts" ? { isHost: true } : filter === "suspended" ? { status: "SUSPENDED" } : {};
  const query = q?.trim();
  if (query) where.OR = [{ name: like(query) }, { email: like(query) }, { phone: { contains: query } }];
  return where;
}

export async function searchUsers({ filter = "all", q, page = 1 }: { filter?: UserFilter; q?: string; page?: number }) {
  const where = userWhere(filter, q);
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageOf(page),
      select: { id: true, name: true, email: true, phone: true, role: true, isHost: true, status: true, emailVerified: true, createdAt: true, _count: { select: { bookings: true, listings: true } } },
    }),
    db.user.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export function userForStaff(id: string) {
  return db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isHost: true,
      status: true,
      emailVerified: true,
      locale: true,
      createdAt: true,
      referredBy: { select: { id: true, name: true } },
      _count: { select: { referrals: true } },
      bookings: { orderBy: { createdAt: "desc" }, take: 20, select: BOOKING_ROW },
      listings: { orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, title: true, status: true, city: true, type: true } },
      tickets: { orderBy: { updatedAt: "desc" }, take: 10, select: { reference: true, subject: true, status: true, updatedAt: true } },
    },
  });
}

/** Suspend (or reactivate) an account. A suspended person is signed out everywhere and can't sign in. Never yourself. */
export async function setUserStatus(adminId: string, userId: string, status: "ACTIVE" | "SUSPENDED", reason: string): Promise<boolean> {
  const why = reason.trim().slice(0, 300);
  if (adminId === userId || (status === "SUSPENDED" && !why)) return false;
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
    if (!user || user.status === status) return false;
    await tx.user.update({ where: { id: userId }, data: { status } });
    if (status === "SUSPENDED") await tx.session.deleteMany({ where: { userId } });
    await audit(tx, { actorId: adminId, action: status === "SUSPENDED" ? "user.suspend" : "user.reactivate", entityType: "user", entityId: userId, data: why ? { reason: why } : undefined });
    return true;
  });
}

export function listingBookings(listingId: string) {
  return db.booking.findMany({ where: { listingId }, orderBy: { createdAt: "desc" }, take: 20, select: BOOKING_ROW });
}

export async function allPayments(page = 1) {
  const [rows, total] = await Promise.all([
    db.payment.findMany({
      orderBy: { createdAt: "desc" },
      ...pageOf(page),
      select: { id: true, provider: true, providerReference: true, amount: true, currency: true, status: true, createdAt: true, booking: { select: { reference: true, listing: { select: { title: true } } } } },
    }),
    db.payment.count(),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

// ---- CSV exports (operational reports) ----

const cell = (value: unknown) => {
  const text = value instanceof Date ? value.toISOString() : value === null || value === undefined ? "" : String(value);
  // Quote every cell; neutralise spreadsheet formulas.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
export const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

export async function bookingsCsv(status?: BookingStatusFilter, q?: string) {
  const rows = await db.booking.findMany({ where: bookingWhere(status, q), orderBy: { createdAt: "desc" }, take: 10_000, select: { ...BOOKING_ROW, subtotal: true, guestFee: true, discount: true, deposit: true, currency: true } });
  return toCsv(
    ["reference", "status", "created", "place", "room", "guest", "guest_email", "unit", "quantity", "check_in", "check_out", "subtotal", "discount", "guest_fee", "deposit", "total", "commission", "owner_payout", "currency"],
    rows.map((b) => [
      b.reference,
      b.status,
      b.createdAt,
      b.listing.title,
      b.room?.name,
      b.guest.name,
      b.guest.email,
      b.unit,
      b.quantity,
      b.checkIn.toISOString().slice(0, 10),
      b.checkOut.toISOString().slice(0, 10),
      b.subtotal,
      b.discount,
      b.guestFee,
      b.deposit,
      b.total,
      b.commission,
      b.hostPayout,
      b.currency,
    ]),
  );
}

export async function ledgerCsv() {
  const rows = await db.ledgerEntry.findMany({ orderBy: { createdAt: "desc" }, take: 50_000, select: { createdAt: true, kind: true, amount: true, currency: true, hostId: true, note: true, booking: { select: { reference: true } }, settlement: { select: { reference: true } } } });
  return toCsv(
    ["date", "kind", "amount", "currency", "booking", "payout", "owner_id", "note"],
    rows.map((e) => [e.createdAt, e.kind, e.amount, e.currency, e.booking?.reference, e.settlement?.reference, e.hostId, e.note]),
  );
}

export async function paymentsCsv() {
  const rows = await db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 50_000, select: { createdAt: true, provider: true, providerReference: true, amount: true, currency: true, status: true, booking: { select: { reference: true } } } });
  return toCsv(["date", "booking", "provider", "transaction", "amount", "currency", "status"], rows.map((p) => [p.createdAt, p.booking.reference, p.provider, p.providerReference, p.amount, p.currency, p.status]));
}
