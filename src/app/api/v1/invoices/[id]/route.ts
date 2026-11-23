import { createTranslator } from "next-intl";
import { formatStayDates, formatKigaliDateTime } from "@/features/bookings/format";
import { invoicePdf } from "@/features/invoices/pdf";
import { canSeeInvoice, invoiceView, type InvoiceLine } from "@/features/invoices/service";
import { getReceiptDetails } from "@/features/receipt/service";
import { catalogs } from "@/i18n/messages";
import { toAppLocale } from "@/i18n/routing";
import { formatRWF } from "@/lib/format";
import { getCurrentUser } from "@/lib/session";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** An invoice as a PDF: for the guest of the booking, or staff handling money or bookings. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return new Response("Not found", { status: 404 });
  const view = await invoiceView(id);
  if (!view || !canSeeInvoice(user, view.invoice.booking.guestId)) return new Response("Not found", { status: 404 });
  const locale = toAppLocale(new URL(request.url).searchParams.get("lang"));
  const t = createTranslator({ locale, messages: catalogs[locale], namespace: "Invoice" });
  const { invoice, payment, stamp } = view;
  const b = invoice.booking;
  const billTo = [
    invoice.companyName ?? invoice.billToName,
    invoice.companyName ? invoice.billToName : null,
    invoice.companyTin ? `${t("tin")} ${invoice.companyTin}` : null,
    invoice.contactPerson ? `${t("contact")}: ${invoice.contactPerson}` : null,
    invoice.address,
    [invoice.billToEmail, invoice.billToPhone].filter(Boolean).join(" - ") || null,
    invoice.extraInfo,
  ].filter((v): v is string => Boolean(v));
  const pdf = await invoicePdf({
    labels: {
      invoice: t("title"),
      number: t("number"),
      issued: t("issued"),
      billTo: t("billTo"),
      tin: t("tin"),
      contact: t("contact"),
      booking: t("booking"),
      place: t("place"),
      stay: t("stay"),
      description: t("description"),
      qty: t("qty"),
      unitPrice: t("unitPrice"),
      amount: t("amount"),
      subtotal: t("subtotal"),
      vat: t("vat"),
      total: t("total"),
      paid: t("paid"),
      paymentRef: t("paymentRef"),
      status: t("statusLabel"),
    },
    stampLabel: t(`stamp.${stamp}`),
    stampTone: stamp === "PAID" ? "green" : stamp === "UNPAID" ? "red" : stamp === "PARTLY_PAID" ? "amber" : "grey",
    business: await getReceiptDetails(),
    number: invoice.number,
    issued: formatKigaliDateTime(locale, invoice.createdAt),
    billTo,
    booking: b.reference,
    place: [b.listing.title, b.listing.district].filter(Boolean).join(", "),
    stay: formatStayDates(locale, iso(b.checkIn), iso(b.checkOut)),
    lines: invoice.lines as InvoiceLine[],
    money: (n) => formatRWF(n, locale),
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    paid: payment.paid,
    references: payment.references,
  });
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.number}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
