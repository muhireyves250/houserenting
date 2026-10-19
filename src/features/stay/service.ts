import "server-only";
import { audit } from "@/features/audit/service";
import { isOverlapError } from "@/features/bookings/service";
import { canTransition } from "@/features/bookings/status";
import { notify, notifyAdmins } from "@/features/notifications/service";
import { todayISO, type ISODate } from "@/features/search/date-range";
import { createTicket } from "@/features/support/service";
import { db } from "@/lib/db";
import { canOn } from "@/features/places/access";
import { checkRequest, daysBetween, priceChangeFor, shouldAutoHide, type RequestInput, type RequestProblem } from "./rules";

type Actor = { id: string; role?: string | null };
const DAY_MS = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (d: ISODate) => new Date(`${d}T00:00:00Z`);

const STAY_SELECT = {
  id: true,
  reference: true,
  status: true,
  checkIn: true,
  checkOut: true,
  startAt: true,
  endAt: true,
  unit: true,
  quantity: true,
  guests: true,
  total: true,
  subtotal: true,
  refundStatus: true,
  refundAmount: true,
  holdExpiresAt: true,
  room: { select: { name: true } },
  policySnapshot: true,
  listing: {
    select: {
      id: true,
      title: true,
      addressLine: true,
      district: true,
      city: true,
      lat: true,
      lng: true,
      guestIdPolicy: true,
      hostId: true,
      host: { select: { name: true, phone: true } },
      photos: { orderBy: { position: "asc" as const }, take: 1, select: { url: true } },
    },
  },
  requests: { orderBy: { createdAt: "desc" as const }, take: 20 },
  feedback: { select: { liked: true, comment: true } },
  guestDocument: { select: { filename: true, createdAt: true } },
} as const;

/**
 * The guest's stay for MY STAY: the one under way, otherwise the next paid (or held) one.
 * `others` lists the rest still to come.
 */
export async function myStay(guestId: string, now: Date = new Date()) {
  const today = todayISO(now);
  const rows = await db.booking.findMany({
    where: {
      guestId,
      OR: [
        { status: { in: ["CONFIRMED", "CHECKED_IN"] }, checkOut: { gte: asDate(today) } },
        { status: "PENDING_PAYMENT", holdExpiresAt: { gt: now } },
      ],
    },
    orderBy: [{ checkIn: "asc" }],
    select: STAY_SELECT,
    take: 10,
  });
  const stays = rows.map((r) => ({ ...r, checkIn: iso(r.checkIn), checkOut: iso(r.checkOut) }));
  const current = stays.find((s) => s.status === "CHECKED_IN" || (s.status === "CONFIRMED" && s.checkIn <= today)) ?? stays[0] ?? null;
  return { current, others: stays.filter((s) => s !== current), today };
}

export type MyStay = NonNullable<Awaited<ReturnType<typeof myStay>>["current"]>;

export type RequestResult = { ok: true } | { ok: false; error: RequestProblem | "notFound" | "pending" };

/** A guest asks to stay longer, leave earlier, move, or cancel a paid stay. Staff and the owner are told. */
export async function requestStayChange(guestId: string, reference: string, input: RequestInput, now: Date = new Date()): Promise<RequestResult> {
  const booking = await db.booking.findFirst({
    where: { guestId, reference },
    select: { id: true, status: true, checkIn: true, checkOut: true, listing: { select: { hostId: true, title: true } } },
  });
  if (!booking) return { ok: false, error: "notFound" };
  const problem = checkRequest({ status: booking.status, checkIn: iso(booking.checkIn), checkOut: iso(booking.checkOut) }, input, todayISO(now));
  if (problem) return { ok: false, error: problem };
  if (await db.stayRequest.findFirst({ where: { bookingId: booking.id, status: "PENDING" }, select: { id: true } })) return { ok: false, error: "pending" };
  await db.$transaction(async (tx) => {
    const request = await tx.stayRequest.create({
      data: {
        bookingId: booking.id,
        kind: input.kind,
        reason: input.reason.trim(),
        newCheckOut: input.kind === "EXTEND" || input.kind === "SHORTEN" ? asDate(input.newCheckOut!) : null,
        transferTo: input.kind === "TRANSFER" ? input.transferTo!.trim() : null,
      },
    });
    await audit(tx, { actorId: guestId, action: "stay.request", entityType: "booking", entityId: reference, data: { request: request.id, kind: input.kind } });
    const data = { reference, title: booking.listing.title, kindLabel: input.kind };
    await notifyAdmins(tx, "stayRequest", data, `/admin/bookings/${reference}`);
    await notify(tx, booking.listing.hostId, "stayRequest", data, null);
  });
  return { ok: true };
}

export async function withdrawStayRequest(guestId: string, requestId: string): Promise<boolean> {
  const { count } = await db.stayRequest.updateMany({ where: { id: requestId, status: "PENDING", booking: { guestId } }, data: { status: "WITHDRAWN" } });
  return count === 1;
}

export type DecideResult = { ok: true } | { ok: false; error: "notFound" | "notAllowed" | "datesTaken" | "invalid" };

/**
 * Staff (or the place's owner) answer a request. Approving applies it:
 * longer → dates move out if free (the difference is to pay); earlier → dates move in and the difference is refunded;
 * cancel → the booking is cancelled with a refund to send; move → agreed, staff arrange the new place.
 */
export async function decideStayRequest(
  actor: Actor,
  requestId: string,
  decision: { approve: boolean; response: string; refundAmount?: number | null },
  now: Date = new Date(),
): Promise<DecideResult> {
  const request = await db.stayRequest.findUnique({
    where: { id: requestId },
    include: { booking: { select: { id: true, reference: true, status: true, checkIn: true, checkOut: true, endAt: true, unit: true, quantity: true, nights: true, subtotal: true, total: true, guestId: true, listingId: true, roomId: true, listing: { select: { hostId: true, title: true } } } } },
  });
  if (!request || request.status !== "PENDING") return { ok: false, error: "notFound" };
  const b = request.booking;
  if (!(await canOn(actor, b.listingId, "requests"))) return { ok: false, error: "notAllowed" };
  const response = decision.response.trim().slice(0, 500);
  if (!decision.approve && !response) return { ok: false, error: "invalid" };
  const refund = decision.refundAmount ?? null;
  if (refund !== null && (!Number.isInteger(refund) || refund < 0 || refund > b.total)) return { ok: false, error: "invalid" };

  try {
    return await db.$transaction(async (tx) => {
      let priceChange: number | null = null;
      if (decision.approve) {
        const stay = { checkIn: iso(b.checkIn), checkOut: iso(b.checkOut), subtotal: b.subtotal };
        if (request.kind === "EXTEND" || request.kind === "SHORTEN") {
          const newOut = iso(request.newCheckOut!);
          const shift = daysBetween(stay.checkOut, newOut);
          priceChange = priceChangeFor(stay, newOut);
          const newEnd = new Date(b.endAt.getTime() + shift * DAY_MS);
          if (request.kind === "EXTEND") {
            const blocked = await tx.availabilityBlock.findFirst({
              where: {
                listingId: b.listingId,
                endedAt: null,
                startsAt: { lt: newEnd },
                OR: [{ endsAt: null }, { endsAt: { gt: b.endAt } }],
                ...(b.roomId ? { roomId: { in: [b.roomId] } } : {}),
              },
              select: { id: true },
            });
            const wholeBlock = b.roomId
              ? await tx.availabilityBlock.findFirst({ where: { listingId: b.listingId, roomId: null, endedAt: null, startsAt: { lt: newEnd }, OR: [{ endsAt: null }, { endsAt: { gt: b.endAt } }] }, select: { id: true } })
              : null;
            if (blocked || wholeBlock) return { ok: false, error: "datesTaken" } as const;
          }
          const perDayUnit = b.unit === "NIGHT" || b.unit === "DAY";
          await tx.booking.update({
            where: { id: b.id },
            data: {
              checkOut: request.newCheckOut!,
              endAt: newEnd,
              nights: Math.max(1, b.nights + shift),
              ...(perDayUnit ? { quantity: Math.max(1, b.quantity + shift) } : {}),
              ...(request.kind === "SHORTEN" && (b.status === "CONFIRMED" || b.status === "CHECKED_IN")
                ? { refundStatus: "PENDING", refundAmount: refund ?? -priceChange }
                : {}),
            },
          });
        } else if (request.kind === "CANCEL") {
          if (!canTransition(b.status, "CANCELLED")) return { ok: false, error: "invalid" } as const;
          await tx.booking.update({ where: { id: b.id }, data: { status: "CANCELLED", refundStatus: "PENDING", refundAmount: refund ?? b.total } });
          await tx.bookingEvent.create({ data: { bookingId: b.id, fromStatus: b.status, toStatus: "CANCELLED", actorId: actor.id, reason: `cancellation request: ${request.reason}` } });
        }
      }
      await tx.stayRequest.update({
        where: { id: request.id },
        data: { status: decision.approve ? "APPROVED" : "DECLINED", response: response || null, priceChange, decidedById: actor.id, decidedAt: now },
      });
      await audit(tx, {
        actorId: actor.id,
        action: decision.approve ? "stay.approve" : "stay.decline",
        entityType: "booking",
        entityId: b.reference,
        data: { request: request.id, kind: request.kind, ...(response ? { reason: response } : {}) },
      });
      await notify(tx, b.guestId, decision.approve ? "stayRequestApproved" : "stayRequestDeclined", { reference: b.reference, title: b.listing.title, kindLabel: request.kind, response }, "/my-stay");
      return { ok: true } as const;
    });
  } catch (error) {
    if (isOverlapError(error)) return { ok: false, error: "datesTaken" };
    throw error;
  }
}

/** Staff record that a refund was sent (or won't be); sent refunds are written to the ledger. */
export async function settleRefund(staffId: string, reference: string, outcome: "REFUNDED" | "DECLINED", note = ""): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { reference }, select: { id: true, guestId: true, refundStatus: true, refundAmount: true, listing: { select: { hostId: true, title: true } } } });
    if (!b || b.refundStatus !== "PENDING") return false;
    await tx.booking.update({ where: { id: b.id }, data: { refundStatus: outcome } });
    if (outcome === "REFUNDED" && (b.refundAmount ?? 0) > 0) {
      await tx.ledgerEntry.create({ data: { kind: "REFUND", amount: b.refundAmount!, bookingId: b.id, hostId: b.listing.hostId, note: note.slice(0, 200) || null } });
    }
    await audit(tx, { actorId: staffId, action: outcome === "REFUNDED" ? "booking.refunded" : "booking.refundDeclined", entityType: "booking", entityId: reference, data: { amount: b.refundAmount ?? 0, ...(note ? { reason: note } : {}) } });
    await notify(tx, b.guestId, outcome === "REFUNDED" ? "refundSent" : "refundDeclined", { reference, title: b.listing.title, amount: b.refundAmount ?? 0 }, "/my-stay");
    return true;
  });
}

/** Staff mark a paid guest who never arrived, from the day after check-in. */
export async function markNoShow(staffId: string, reference: string, now: Date = new Date()): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { reference }, select: { id: true, status: true, checkIn: true, guestId: true, listing: { select: { title: true } } } });
    if (!b || !canTransition(b.status, "NO_SHOW") || iso(b.checkIn) >= todayISO(now)) return false;
    const { count } = await tx.booking.updateMany({ where: { id: b.id, status: b.status }, data: { status: "NO_SHOW" } });
    if (count !== 1) return false;
    await tx.bookingEvent.create({ data: { bookingId: b.id, fromStatus: b.status, toStatus: "NO_SHOW", actorId: staffId, reason: "guest did not arrive" } });
    await audit(tx, { actorId: staffId, action: "booking.noShow", entityType: "booking", entityId: reference });
    return true;
  });
}

/** A problem during the stay becomes a support request linked to the booking. */
export async function reportStayIssue(guestId: string, reference: string, subject: string, body: string) {
  return createTicket(guestId, { category: "COMPLAINT", subject, body, bookingReference: reference });
}

const DISLIKE_WINDOW_DAYS = 90;

/**
 * Like or dislike (once per stay, changeable), from arrival on. Too many dislikes in 90 days hide the place
 * automatically (when staff set a limit), unless staff chose to keep it visible.
 */
export async function saveStayFeedback(guestId: string, reference: string, liked: boolean, comment: string, now: Date = new Date()): Promise<{ ok: boolean; hidden?: boolean }> {
  const b = await db.booking.findFirst({
    where: { guestId, reference },
    select: { id: true, status: true, checkIn: true, listingId: true, listing: { select: { title: true, status: true, keepVisible: true, hostId: true } } },
  });
  const started = b && (b.status === "CHECKED_IN" || b.status === "COMPLETED" || (b.status === "CONFIRMED" && iso(b.checkIn) <= todayISO(now)));
  if (!b || !started) return { ok: false };
  const text = comment.trim().slice(0, 500) || null;
  return db.$transaction(async (tx) => {
    await tx.stayFeedback.upsert({ where: { bookingId: b.id }, create: { bookingId: b.id, listingId: b.listingId, liked, comment: text }, update: { liked, comment: text } });
    if (liked || b.listing.status !== "PUBLISHED") return { ok: true };
    const config = await tx.platformConfig.findUnique({ where: { id: 1 }, select: { dislikeHideCount: true } });
    const dislikes = await tx.stayFeedback.count({ where: { listingId: b.listingId, liked: false, updatedAt: { gte: new Date(now.getTime() - DISLIKE_WINDOW_DAYS * DAY_MS) } } });
    if (!shouldAutoHide(dislikes, config?.dislikeHideCount ?? null, b.listing.keepVisible)) return { ok: true };
    const reason = `Hidden automatically: ${dislikes} dislikes in ${DISLIKE_WINDOW_DAYS} days`;
    await tx.listing.update({ where: { id: b.listingId }, data: { status: "HIDDEN", rejectionReason: reason } });
    await audit(tx, { actorId: null, action: "listing.autoHide", entityType: "listing", entityId: b.listingId, data: { from: "PUBLISHED", to: "HIDDEN", reason } });
    await notifyAdmins(tx, "listingAutoHidden", { title: b.listing.title, count: dislikes }, `/admin/listings/${b.listingId}`);
    await notify(tx, b.listing.hostId, "listingStatus", { title: b.listing.title, status: "HIDDEN", reason }, `/host/listings/${b.listingId}`);
    return { ok: true, hidden: true };
  });
}

/** Requests waiting for an answer, oldest first (staff queue). */
export function pendingStayRequests(take = 100) {
  return db.stayRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take,
    include: { booking: { select: { reference: true, checkIn: true, checkOut: true, guest: { select: { name: true } }, listing: { select: { title: true } } } } },
  });
}

/** Refunds approved but not yet sent, oldest first. */
export function pendingRefunds(take = 100) {
  return db.booking.findMany({
    where: { refundStatus: "PENDING" },
    orderBy: { updatedAt: "asc" },
    take,
    select: { reference: true, refundAmount: true, updatedAt: true, guest: { select: { name: true } }, listing: { select: { title: true } } },
  });
}

/** A booking's requests and refund for the staff booking page. */
export function bookingRequests(bookingId: string) {
  return db.stayRequest.findMany({ where: { bookingId }, orderBy: { createdAt: "desc" } });
}
