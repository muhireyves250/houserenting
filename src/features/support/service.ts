import "server-only";
import { audit } from "@/features/audit/service";
import { newTicketReference } from "@/features/bookings/reference";
import { notify, notifyAdmins } from "@/features/notifications/service";
import { db } from "@/lib/db";

import { TICKET_CATEGORIES_LIST } from "./categories";

export const TICKET_CATEGORIES = TICKET_CATEGORIES_LIST;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

/** The support state machine. A customer reply reopens a resolved request; closed is final. */
const TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["OPEN", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "CLOSED"],
  CLOSED: [],
};

export function canMoveTicket(from: TicketStatus, to: TicketStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

const BODY_MAX = 4000;
const clean = (text: string) => text.trim();
const validBody = (text: string) => text.length >= 2 && text.length <= BODY_MAX;

export type NewTicket = { category: TicketCategory; subject: string; body: string; bookingReference?: string | null };

export async function createTicket(userId: string, input: NewTicket): Promise<{ ok: true; reference: string } | { ok: false }> {
  const subject = clean(input.subject);
  const body = clean(input.body);
  if (!TICKET_CATEGORIES.includes(input.category) || subject.length < 3 || subject.length > 120 || !validBody(body)) return { ok: false };
  // Only link a booking that belongs to this customer.
  let bookingReference: string | null = null;
  if (input.bookingReference) {
    const own = await db.booking.findFirst({ where: { reference: input.bookingReference, guestId: userId }, select: { reference: true } });
    bookingReference = own?.reference ?? null;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const reference = newTicketReference();
    try {
      await db.$transaction(async (tx) => {
        const ticket = await tx.supportTicket.create({
          data: { reference, userId, category: input.category, subject, bookingReference, messages: { create: { authorId: userId, body } } },
        });
        await audit(tx, { actorId: userId, action: "ticket.open", entityType: "ticket", entityId: ticket.reference });
        await notifyAdmins(tx, "ticketOpened", { subject, reference }, `/admin/support/${reference}`);
      });
      return { ok: true, reference };
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  return { ok: false };
}

const TICKET_SELECT = {
  reference: true,
  category: true,
  subject: true,
  status: true,
  bookingReference: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function myTickets(userId: string) {
  return db.supportTicket.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, select: TICKET_SELECT });
}

const THREAD = { messages: { orderBy: { createdAt: "asc" as const }, select: { id: true, body: true, fromStaff: true, createdAt: true, author: { select: { name: true } } } } };

export function getMyTicket(userId: string, reference: string) {
  return db.supportTicket.findFirst({ where: { userId, reference }, select: { ...TICKET_SELECT, ...THREAD } });
}

/** The customer adds to their request; a resolved request opens again. */
export async function customerReply(userId: string, reference: string, text: string): Promise<boolean> {
  const body = clean(text);
  if (!validBody(body)) return false;
  return db.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findFirst({ where: { userId, reference }, select: { id: true, status: true, subject: true } });
    if (!ticket || ticket.status === "CLOSED") return false;
    await tx.supportMessage.create({ data: { ticketId: ticket.id, authorId: userId, body } });
    const status = ticket.status === "RESOLVED" ? "OPEN" : ticket.status;
    await tx.supportTicket.update({ where: { id: ticket.id }, data: { status } });
    if (status !== ticket.status) {
      await audit(tx, { actorId: userId, action: "ticket.status", entityType: "ticket", entityId: reference, data: { from: ticket.status, to: status } });
    }
    await notifyAdmins(tx, "ticketReply", { subject: ticket.subject, reference }, `/admin/support/${reference}`);
    return true;
  });
}

export function staffTickets(status?: TicketStatus) {
  return db.supportTicket.findMany({
    where: status ? { status } : { status: { in: ["OPEN", "IN_PROGRESS"] } },
    orderBy: { updatedAt: "asc" },
    take: 100,
    select: { ...TICKET_SELECT, user: { select: { name: true, email: true } } },
  });
}

export function staffTicket(reference: string) {
  return db.supportTicket.findUnique({ where: { reference }, select: { ...TICKET_SELECT, user: { select: { name: true, email: true, phone: true } }, ...THREAD } });
}

/** Staff answer: an open request moves to in progress; the customer is told. */
export async function staffReply(adminId: string, reference: string, text: string): Promise<boolean> {
  const body = clean(text);
  if (!validBody(body)) return false;
  return db.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({ where: { reference }, select: { id: true, status: true, userId: true, subject: true } });
    if (!ticket || ticket.status === "CLOSED") return false;
    await tx.supportMessage.create({ data: { ticketId: ticket.id, authorId: adminId, body, fromStaff: true } });
    const status = ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status;
    await tx.supportTicket.update({ where: { id: ticket.id }, data: { status } });
    await audit(tx, { actorId: adminId, action: "ticket.reply", entityType: "ticket", entityId: reference, data: status !== ticket.status ? { from: ticket.status, to: status } : undefined });
    await notify(tx, ticket.userId, "ticketReply", { subject: ticket.subject, reference }, `/support/${reference}`);
    return true;
  });
}

export async function setTicketStatus(adminId: string, reference: string, to: TicketStatus): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findUnique({ where: { reference }, select: { id: true, status: true, userId: true, subject: true } });
    if (!ticket || !canMoveTicket(ticket.status, to)) return false;
    await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: to } });
    await audit(tx, { actorId: adminId, action: "ticket.status", entityType: "ticket", entityId: reference, data: { from: ticket.status, to } });
    await notify(tx, ticket.userId, "ticketStatus", { subject: ticket.subject, reference, status: to }, `/support/${reference}`);
    return true;
  });
}
