import "server-only";
import { z } from "zod";
import { audit } from "@/features/audit/service";
import { readSettings } from "@/features/settings/service";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { canStaff } from "@/lib/roles";

type Actor = { id: string; role?: string | null; staffAreas?: readonly string[] | null };
export type InvoiceLine = { description: string; quantity: number; unitPrice: number };
export type PaymentState = "UNPAID" | "PARTLY_PAID" | "PAID";

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable().default(null);

/** Who the invoice is for: the guest themself, or an organisation (company name and TIN). */
export const billToInput = z.object({
  billToName: z.string().trim().min(2).max(120),
  billToEmail: z.email().max(200).nullable().default(null).or(z.literal("").transform(() => null)),
  billToPhone: text(30),
  companyName: text(160),
  companyTin: text(30),
  contactPerson: text(120),
  address: text(200),
  extraInfo: text(500),
});
export type BillToInput = z.input<typeof billToInput>;

const lineInput = z.object({ description: z.string().trim().min(1).max(200), quantity: z.number().int().min(1).max(10_000), unitPrice: z.number().int().min(-100_000_000).max(100_000_000) });

const BOOKING = {
  id: true,
  reference: true,
  status: true,
  guestId: true,
  unit: true,
  quantity: true,
  nights: true,
  nightlyPrice: true,
  subtotal: true,
  discount: true,
  guestFee: true,
  total: true,
  guest: { select: { name: true, email: true, phone: true } },
  listing: { select: { title: true } },
  promoCode: { select: { code: true } },
} as const;
type InvoiceBooking = Prisma.BookingGetPayload<{ select: typeof BOOKING }>;

/** The lines of a booking's invoice: the stay, any promo discount, the service fee. */
export function linesForBooking(b: InvoiceBooking): InvoiceLine[] {
  const units = b.quantity || b.nights || 1;
  const lines: InvoiceLine[] = [{ description: `${b.listing.title} · ${b.unit.toLowerCase()}`, quantity: units, unitPrice: Math.round(b.subtotal / units) }];
  if (b.discount > 0) lines.push({ description: `Promo ${b.promoCode?.code ?? ""}`.trim(), quantity: 1, unitPrice: -b.discount });
  if (b.guestFee > 0) lines.push({ description: "Service fee", quantity: 1, unitPrice: b.guestFee });
  return lines;
}

const sumLines = (lines: InvoiceLine[]) => lines.reduce((n, l) => n + l.quantity * l.unitPrice, 0);
/** VAT already included in a total, at the platform's rate (none set: 0). */
const includedVat = (total: number, vatBps: number | null) => (vatBps ? Math.round((total * vatBps) / (10_000 + vatBps)) : 0);

/** How much of the booking was paid: unpaid, partly paid or paid (from payments actually received). */
export async function paymentStateOf(bookingId: string, total: number): Promise<{ state: PaymentState; paid: number; references: string[] }> {
  const payments = await db.payment.findMany({ where: { bookingId, status: "SUCCEEDED" }, select: { amount: true, providerReference: true } });
  const paid = payments.reduce((n, p) => n + p.amount, 0);
  return { state: paid <= 0 ? "UNPAID" : paid < total ? "PARTLY_PAID" : "PAID", paid, references: payments.map((p) => p.providerReference).filter((r): r is string => Boolean(r)) };
}

async function mayHandle(actor: Actor, b: { guestId: string }) {
  return b.guestId === actor.id || canStaff(actor, "money") || canStaff(actor, "bookings");
}

/** The invoice in force for a booking (its latest version), if one was issued. */
export function currentInvoice(bookingId: string) {
  return db.invoice.findFirst({ where: { bookingId, state: "ISSUED" }, orderBy: { version: "desc" } });
}

/** The invoice in force for a booking, by its reference. */
export function currentInvoiceFor(reference: string) {
  return db.invoice.findFirst({ where: { booking: { reference }, state: "ISSUED" }, orderBy: { version: "desc" }, select: { id: true } });
}

export function invoiceHistory(bookingId: string) {
  return db.invoice.findMany({ where: { bookingId }, orderBy: { version: "desc" } });
}

export type InvoiceResult = { ok: true; id: string } | { ok: false; error: "notFound" | "notAllowed" } | { ok: false; errors: Record<string, string> };

/**
 * Gets the booking's invoice, issuing it the first time (in the guest's name). With `billTo` (e.g. a company's name
 * and TIN), a new version is issued and the previous one is kept as corrected. Never overwrites an issued invoice.
 */
export async function issueInvoice(actor: Actor, reference: string, billTo?: BillToInput, note?: string): Promise<InvoiceResult> {
  const b = await db.booking.findUnique({ where: { reference }, select: BOOKING });
  if (!b) return { ok: false, error: "notFound" };
  if (!(await mayHandle(actor, b))) return { ok: false, error: "notAllowed" };
  const existing = await currentInvoice(b.id);
  if (existing && !billTo) return { ok: true, id: existing.id };
  let details: z.output<typeof billToInput>;
  if (billTo) {
    const parsed = billToInput.safeParse(billTo);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) errors[issue.path.join(".") || "form"] ??= issue.message;
      return { ok: false, errors };
    }
    details = parsed.data;
  } else {
    details = { billToName: b.guest.name, billToEmail: b.guest.email, billToPhone: b.guest.phone, companyName: null, companyTin: null, contactPerson: null, address: null, extraInfo: null };
  }
  const lines = (existing?.lines as InvoiceLine[] | undefined) ?? linesForBooking(b);
  return writeVersion(actor, b, existing, details, lines, note ?? (billTo ? "billing details" : null));
}

async function writeVersion(
  actor: Actor,
  b: { id: string; reference: string },
  previous: { id: string; version: number; ebmRequested: boolean } | null,
  details: z.output<typeof billToInput>,
  lines: InvoiceLine[],
  note: string | null,
): Promise<InvoiceResult> {
  const vatBps = (await readSettings()).vatBps ?? null;
  const total = sumLines(lines);
  return db.$transaction(async (tx) => {
    const last = await tx.invoice.findFirst({ where: { bookingId: b.id }, orderBy: { version: "desc" }, select: { version: true } });
    const version = (last?.version ?? 0) + 1;
    if (previous) await tx.invoice.update({ where: { id: previous.id }, data: { state: "CORRECTED", note } });
    const created = await tx.invoice.create({
      data: { number: `INV-${b.reference}-${version}`, bookingId: b.id, version, ...details, lines, subtotal: total - includedVat(total, vatBps), tax: includedVat(total, vatBps), total, ebmRequested: previous?.ebmRequested ?? false, createdById: actor.id },
    });
    await audit(tx, { actorId: actor.id, action: previous ? "invoice.correct" : "invoice.issue", entityType: "booking", entityId: b.reference, data: { number: created.number, ...(previous ? { replaces: previous.id } : {}), ...(note ? { note } : {}) } });
    return { ok: true, id: created.id } as const;
  });
}

/** Staff correct an invoice (details, descriptions, quantities): a new version; the original stays in the history. */
export async function correctInvoice(actor: Actor, invoiceId: string, billTo: BillToInput, rawLines: InvoiceLine[], reason: string): Promise<InvoiceResult> {
  if (!canStaff(actor, "money") && !canStaff(actor, "bookings")) return { ok: false, error: "notAllowed" };
  const why = reason.trim().slice(0, 300);
  if (!why) return { ok: false, errors: { note: "reason" } };
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, version: true, state: true, ebmRequested: true, booking: { select: { id: true, reference: true } } } });
  if (!invoice || invoice.state !== "ISSUED") return { ok: false, error: "notFound" };
  const parsed = billToInput.safeParse(billTo);
  const lines = z.array(lineInput).min(1).max(30).safeParse(rawLines);
  if (!parsed.success || !lines.success) return { ok: false, errors: { form: "invalid" } };
  return writeVersion(actor, invoice.booking, invoice, parsed.data, lines.data, why);
}

/** Staff cancel an invoice (with a reason); it stays on record. */
export async function cancelInvoice(actor: Actor, invoiceId: string, reason: string): Promise<boolean> {
  if (!canStaff(actor, "money") && !canStaff(actor, "bookings")) return false;
  const why = reason.trim().slice(0, 300);
  if (!why) return false;
  return db.$transaction(async (tx) => {
    const { count } = await tx.invoice.updateMany({ where: { id: invoiceId, state: "ISSUED" }, data: { state: "CANCELLED", note: why } });
    if (count === 1) await audit(tx, { actorId: actor.id, action: "invoice.cancel", entityType: "invoice", entityId: invoiceId, data: { reason: why } });
    return count === 1;
  });
}

/** The guest asks for an EBM (electronic billing machine) invoice; staff are told. */
export async function requestEbm(actor: Actor, reference: string): Promise<boolean> {
  const issued = await issueInvoice(actor, reference);
  if (!issued.ok) return false;
  const { count } = await db.invoice.updateMany({ where: { id: issued.id, ebmRequested: false }, data: { ebmRequested: true } });
  if (count === 1) {
    const { notifyAdmins } = await import("@/features/notifications/service");
    await notifyAdmins(db, "ebmRequested", { reference }, `/admin/bookings/${reference}`);
  }
  return true;
}

/** Everything the invoice page and PDF show. */
export async function invoiceView(invoiceId: string) {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: { booking: { select: { id: true, reference: true, status: true, guestId: true, checkIn: true, checkOut: true, listing: { select: { title: true, addressLine: true, district: true } } } } } });
  if (!invoice) return null;
  const payment = await paymentStateOf(invoice.booking.id, invoice.total);
  const bookingCancelled = invoice.booking.status === "CANCELLED" || invoice.booking.status === "EXPIRED";
  const stamp = invoice.state === "CORRECTED" ? "CORRECTED" : invoice.state === "CANCELLED" || (bookingCancelled && payment.state === "UNPAID") ? "CANCELLED" : payment.state;
  return { invoice, payment, stamp: stamp as PaymentState | "CANCELLED" | "CORRECTED" };
}

export const canSeeInvoice = (actor: Actor, guestId: string) => guestId === actor.id || canStaff(actor, "money") || canStaff(actor, "bookings");
