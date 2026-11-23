import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/test/db";
import { cancelInvoice, correctInvoice, currentInvoice, invoiceHistory, invoiceView, issueInvoice, requestEbm } from "./service";

const admin = { id: "admin", role: "ADMIN" };
let bookingId = "";

beforeEach(async () => {
  await resetDb();
  await db.listing.deleteMany();
  await db.user.createMany({
    data: [
      { id: "owner", name: "Owner", email: "owner@example.com" },
      { id: "guest", name: "Guest Person", email: "guest@example.com", phone: "0788000111" },
      { id: "other", name: "Other", email: "other@example.com" },
      { id: "admin", name: "Admin", email: "admin@example.com", role: "ADMIN" },
    ],
  });
  await db.listing.create({
    data: { id: "house", hostId: "owner", title: "Lake house", description: "Nice", type: "PRIVATE_HOUSE", status: "PUBLISHED", addressLine: "KG 1", district: "Rubavu", city: "Gisenyi", lat: -1.7, lng: 29.26, sizeM2: 90, rooms: 3, bedrooms: 2, bathrooms: 1, maxGuests: 4 },
  });
  const b = await db.booking.create({
    data: {
      reference: "SR-INV234", listingId: "house", guestId: "guest", status: "CONFIRMED",
      checkIn: new Date("2026-12-01T00:00:00Z"), checkOut: new Date("2026-12-03T00:00:00Z"),
      startAt: new Date("2026-12-01T12:00:00Z"), endAt: new Date("2026-12-03T09:00:00Z"),
      nights: 2, quantity: 2, guests: 2, nightlyPrice: 50_000, subtotal: 100_000, discount: 10_000, guestFee: 4_500, total: 94_500, commission: 10_000, hostPayout: 80_000, policySnapshot: {},
    },
  });
  bookingId = b.id;
});

describe("invoices", () => {
  it("the guest gets an unpaid invoice, then paid once payments arrive; others can't", async () => {
    expect(await issueInvoice({ id: "other" }, "SR-INV234")).toEqual({ ok: false, error: "notAllowed" });
    const issued = await issueInvoice({ id: "guest" }, "SR-INV234");
    if (!issued.ok) throw new Error("issue failed");
    // Asking again gives the same invoice.
    expect(await issueInvoice({ id: "guest" }, "SR-INV234")).toEqual(issued);
    const inv = await db.invoice.findUniqueOrThrow({ where: { id: issued.id } });
    expect(inv).toMatchObject({ number: "INV-SR-INV234-1", billToName: "Guest Person", total: 94_500 });
    expect((inv.lines as { unitPrice: number; quantity: number }[]).reduce((n, l) => n + l.unitPrice * l.quantity, 0)).toBe(94_500);
    expect((await invoiceView(issued.id))?.stamp).toBe("UNPAID");
    await db.payment.create({ data: { bookingId, provider: "manual", providerReference: "MP-1", amount: 50_000, status: "SUCCEEDED" } });
    expect((await invoiceView(issued.id))?.stamp).toBe("PARTLY_PAID");
    await db.payment.create({ data: { bookingId, provider: "manual", providerReference: "MP-2", amount: 44_500, status: "SUCCEEDED" } });
    expect(await invoiceView(issued.id)).toMatchObject({ stamp: "PAID", payment: { paid: 94_500, references: ["MP-1", "MP-2"] } });
  });

  it("an invoice in a company's name is a new version; staff corrections never overwrite; cancelling needs a reason", async () => {
    const first = await issueInvoice({ id: "guest" }, "SR-INV234");
    if (!first.ok) throw new Error("issue failed");
    const company = await issueInvoice({ id: "guest" }, "SR-INV234", { billToName: "Guest Person", companyName: "Acme Ltd", companyTin: "123456789", contactPerson: "Guest Person", address: "KN 4 Ave", billToEmail: "acc@acme.rw" });
    if (!company.ok) throw new Error("company failed");
    expect((await db.invoice.findUniqueOrThrow({ where: { id: first.id } })).state).toBe("CORRECTED");
    expect(await db.invoice.findUniqueOrThrow({ where: { id: company.id } })).toMatchObject({ number: "INV-SR-INV234-2", companyName: "Acme Ltd", companyTin: "123456789", state: "ISSUED" });

    const lines = [{ description: "Lake house · 2 nights", quantity: 2, unitPrice: 50_000 }];
    expect(await correctInvoice({ id: "guest" }, company.id, { billToName: "Guest Person", companyName: "Acme Ltd" }, lines, "fix")).toEqual({ ok: false, error: "notAllowed" });
    expect(await correctInvoice(admin, company.id, { billToName: "Guest Person", companyName: "Acme Ltd" }, lines, "")).toMatchObject({ ok: false });
    const fixed = await correctInvoice(admin, company.id, { billToName: "Guest Person", companyName: "Acme Rwanda Ltd" }, lines, "Company name spelling");
    if (!fixed.ok) throw new Error("correct failed");
    expect(await db.invoice.findUniqueOrThrow({ where: { id: fixed.id } })).toMatchObject({ version: 3, companyName: "Acme Rwanda Ltd", total: 100_000 });
    expect((await invoiceHistory(bookingId)).map((i) => [i.version, i.state])).toEqual([[3, "ISSUED"], [2, "CORRECTED"], [1, "CORRECTED"]]);
    expect(await db.auditLog.count({ where: { action: "invoice.correct" } })).toBe(2);

    expect(await requestEbm({ id: "guest" }, "SR-INV234")).toBe(true);
    expect((await currentInvoice(bookingId))?.ebmRequested).toBe(true);

    expect(await cancelInvoice(admin, fixed.id, "")).toBe(false);
    expect(await cancelInvoice(admin, fixed.id, "Booking moved")).toBe(true);
    expect((await invoiceView(fixed.id))?.stamp).toBe("CANCELLED");
  });

  it("makes a PDF", async () => {
    const { invoicePdf } = await import("./pdf");
    const pdf = await invoicePdf({
      labels: { invoice: "Invoice", number: "No.", issued: "Issued", billTo: "Bill to", tin: "TIN", contact: "Contact", booking: "Booking", place: "Property", stay: "Stay", description: "Description", qty: "Qty", unitPrice: "Unit", amount: "Amount", subtotal: "Subtotal", vat: "VAT", total: "Total", paid: "Paid", paymentRef: "Ref", status: "Status" },
      stampLabel: "Unpaid",
      stampTone: "red",
      business: { businessName: "VIIPA Ltd", address: null, phone: null, email: null, tin: "123", footer: null },
      number: "INV-SR-INV234-1",
      issued: "1 Dec 2026",
      billTo: ["Guest Person"],
      booking: "SR-INV234",
      place: "Lake house",
      stay: "Dec 1 – 3",
      lines: [{ description: "Stay", quantity: 2, unitPrice: 50_000 }],
      money: (n) => `RWF ${n}`,
      subtotal: 100_000,
      tax: 0,
      total: 100_000,
      paid: 0,
      references: [],
    });
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
