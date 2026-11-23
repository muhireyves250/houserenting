"use server";

import { revalidatePath } from "next/cache";
import { isBookingReference } from "@/features/bookings/reference";
import { getCurrentUser } from "@/lib/session";
import { cancelInvoice, correctInvoice, issueInvoice, requestEbm, type BillToInput, type InvoiceLine, type InvoiceResult } from "./service";

const done = <T extends { ok: boolean }>(r: T) => {
  if (r.ok) revalidatePath("/[locale]", "layout");
  return r;
};

/** Get the booking's invoice (issued the first time, in the guest's name). */
export async function issueInvoiceAction(reference: string): Promise<InvoiceResult> {
  const user = await getCurrentUser();
  if (!user || typeof reference !== "string" || !isBookingReference(reference)) return { ok: false, error: "notAllowed" };
  return done(await issueInvoice(user, reference));
}

/** An invoice in an organisation's name (or other details): a new version; the previous one is kept. */
export async function billToInvoiceAction(reference: string, billTo: BillToInput): Promise<InvoiceResult> {
  const user = await getCurrentUser();
  if (!user || typeof reference !== "string" || !isBookingReference(reference)) return { ok: false, error: "notAllowed" };
  return done(await issueInvoice(user, reference, billTo));
}

export async function requestEbmAction(reference: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || typeof reference !== "string" || !isBookingReference(reference)) return { ok: false };
  return done({ ok: await requestEbm(user, reference) });
}

/** Staff: correct an invoice (new version, the original stays in the history). */
export async function correctInvoiceAction(invoiceId: string, billTo: BillToInput, lines: InvoiceLine[], reason: string): Promise<InvoiceResult> {
  const user = await getCurrentUser();
  if (!user || typeof invoiceId !== "string" || invoiceId.length > 40 || !Array.isArray(lines) || typeof reason !== "string") return { ok: false, error: "notAllowed" };
  return done(await correctInvoice(user, invoiceId, billTo, lines, reason));
}

export async function cancelInvoiceAction(invoiceId: string, reason: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user || typeof invoiceId !== "string" || invoiceId.length > 40 || typeof reason !== "string") return { ok: false };
  return done({ ok: await cancelInvoice(user, invoiceId, reason) });
}
