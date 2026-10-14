"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isTicketReference } from "@/features/bookings/reference";
import { isAdmin } from "@/lib/roles";
import { getCurrentUser } from "@/lib/session";
import { createTicket, customerReply, setTicketStatus, staffReply, TICKET_CATEGORIES, type TicketStatus } from "./service";

const newTicket = z.object({
  category: z.enum(TICKET_CATEGORIES),
  subject: z.string().max(120),
  body: z.string().max(4000),
  bookingReference: z.string().max(12).nullable().optional(),
});

export async function createTicketAction(raw: unknown): Promise<{ reference: string } | { error: "auth" | "invalid" }> {
  const user = await getCurrentUser();
  if (!user) return { error: "auth" };
  const parsed = newTicket.safeParse(raw);
  if (!parsed.success) return { error: "invalid" };
  const result = await createTicket(user.id, parsed.data);
  if (!result.ok) return { error: "invalid" };
  revalidatePath("/[locale]/support", "layout");
  return { reference: result.reference };
}

export async function replyTicketAction(reference: string, body: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || typeof reference !== "string" || !isTicketReference(reference) || typeof body !== "string") return { ok: false };
  // Staff answer as staff; everyone else can only write on their own requests.
  const ok = isAdmin(user) && !(await ownsTicket(user.id, reference)) ? await staffReply(user.id, reference, body) : await customerReply(user.id, reference, body);
  if (ok) {
    revalidatePath("/[locale]/support", "layout");
    revalidatePath("/[locale]/admin/support", "layout");
  }
  return { ok };
}

async function ownsTicket(userId: string, reference: string) {
  const { db } = await import("@/lib/db");
  return (await db.supportTicket.count({ where: { reference, userId } })) > 0;
}

const STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export async function setTicketStatusAction(reference: string, status: TicketStatus): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user) || typeof reference !== "string" || !isTicketReference(reference) || !STATUSES.includes(status)) return { ok: false };
  const ok = await setTicketStatus(user.id, reference, status);
  if (ok) revalidatePath("/[locale]/admin/support", "layout");
  return { ok };
}
