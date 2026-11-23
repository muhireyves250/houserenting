import "server-only";
import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFImage } from "pdf-lib";
import { getEnv } from "@/lib/env";
import type { ReceiptDetails } from "@/features/receipt/validation";
import type { InvoiceLine } from "./service";

const plain = (s: string) =>
  s
    .replace(/[   ]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/·/g, "-")
    .replace(/[^\x20-\x7E¡-ÿ]/g, "");

export type InvoicePdfData = {
  labels: Record<"invoice" | "number" | "issued" | "billTo" | "tin" | "contact" | "booking" | "place" | "stay" | "description" | "qty" | "unitPrice" | "amount" | "subtotal" | "vat" | "total" | "paid" | "paymentRef" | "status", string>;
  stampLabel: string;
  stampTone: "red" | "green" | "amber" | "grey";
  business: ReceiptDetails;
  number: string;
  issued: string;
  billTo: string[];
  booking: string;
  place: string;
  stay: string;
  lines: InvoiceLine[];
  money: (n: number) => string;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  references: string[];
};

/** The VIIPA logo for the PDF (from the site's own files); the invoice still prints without it. */
async function logo(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    const res = await fetch(new URL("/brand/viipa-logo.png", getEnv().BETTER_AUTH_URL), { cache: "force-cache" });
    return res.ok ? await doc.embedPng(new Uint8Array(await res.arrayBuffer())) : null;
  } catch {
    return null;
  }
}

/** A one-page A4 invoice: logo and company, number and dates, who it's for, the lines, VAT, and its status stamp. */
export async function invoicePdf(d: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(plain(`${d.labels.invoice} ${d.number}`));
  const page = doc.addPage([595, 842]);
  const [regular, bold, image] = await Promise.all([doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold), logo(doc)]);
  const ink = rgb(0.06, 0.1, 0.18);
  const muted = rgb(0.4, 0.44, 0.5);
  const line = rgb(0.85, 0.87, 0.9);
  const brand = rgb(0, 0.34, 0.72);
  const M = 48;
  const W = 595 - M * 2;
  let y = 842 - M;
  const text = (s: string, x: number, size: number, font: PDFFont = regular, color = ink) => page.drawText(plain(s), { x, y, size, font, color });
  const right = (s: string, xRight: number, size: number, font: PDFFont = regular, color = ink) => {
    const v = plain(s);
    page.drawText(v, { x: xRight - font.widthOfTextAtSize(v, size), y, size, font, color });
  };
  const fit = (s: string, size: number, font: PDFFont, max: number) => {
    let v = plain(s);
    while (v.length > 1 && font.widthOfTextAtSize(v, size) > max) v = v.slice(0, -2);
    return v;
  };

  // Header: logo and the business on the left, INVOICE and its number on the right.
  if (image) {
    const h = 46;
    page.drawImage(image, { x: M, y: y - h + 10, width: (image.width / image.height) * h, height: h });
    y -= h + 4;
  } else {
    text(d.business.businessName || "VIIPA", M, 20, bold, brand);
    y -= 24;
  }
  const top = 842 - M;
  const saveY = y;
  y = top;
  right(d.labels.invoice.toUpperCase(), 595 - M, 22, bold, brand);
  y -= 20;
  right(`${d.labels.number}: ${d.number}`, 595 - M, 10, bold);
  y -= 14;
  right(`${d.labels.issued}: ${d.issued}`, 595 - M, 10, regular, muted);
  y = saveY;
  const biz = [d.business.businessName || "VIIPA", d.business.address, [d.business.phone, d.business.email].filter(Boolean).join(" - "), d.business.tin ? `TIN ${d.business.tin}` : null].filter((v): v is string => Boolean(v));
  for (const [i, l] of biz.entries()) {
    text(l, M, i === 0 ? 11 : 9, i === 0 ? bold : regular, i === 0 ? ink : muted);
    y -= 13;
  }
  y -= 14;
  page.drawLine({ start: { x: M, y }, end: { x: 595 - M, y }, thickness: 1, color: line });
  y -= 22;

  // Bill to, and the booking.
  const colY = y;
  text(d.labels.billTo.toUpperCase(), M, 8, bold, muted);
  y -= 14;
  for (const [i, l] of d.billTo.entries()) {
    text(fit(l, i === 0 ? 11 : 9.5, i === 0 ? bold : regular, W / 2 - 10), M, i === 0 ? 11 : 9.5, i === 0 ? bold : regular);
    y -= 13;
  }
  const leftEnd = y;
  y = colY;
  const x2 = M + W / 2 + 10;
  for (const [label, value] of [
    [d.labels.booking, d.booking],
    [d.labels.place, d.place],
    [d.labels.stay, d.stay],
  ] as const) {
    text(label.toUpperCase(), x2, 8, bold, muted);
    y -= 12;
    text(fit(value, 9.5, regular, W / 2 - 10), x2, 9.5);
    y -= 16;
  }
  y = Math.min(y, leftEnd) - 16;

  // Lines.
  const cols = { desc: M + 8, qty: M + W * 0.6, unit: M + W * 0.8, amount: 595 - M - 8 };
  page.drawRectangle({ x: M, y: y - 6, width: W, height: 22, color: rgb(0.95, 0.96, 0.98) });
  text(d.labels.description, cols.desc, 9, bold);
  right(d.labels.qty, cols.qty, 9, bold);
  right(d.labels.unitPrice, cols.unit, 9, bold);
  right(d.labels.amount, cols.amount, 9, bold);
  y -= 24;
  for (const l of d.lines) {
    text(fit(l.description, 9.5, regular, W * 0.5), cols.desc, 9.5);
    right(String(l.quantity), cols.qty, 9.5);
    right(d.money(l.unitPrice), cols.unit, 9.5);
    right(d.money(l.quantity * l.unitPrice), cols.amount, 9.5);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: 595 - M, y }, thickness: 0.5, color: line });
    y -= 14;
  }

  // Totals.
  y -= 6;
  const totals: [string, number, boolean][] = [
    [d.labels.subtotal, d.subtotal, false],
    [d.labels.vat, d.tax, false],
    [d.labels.total, d.total, true],
    [d.labels.paid, d.paid, false],
  ];
  for (const [label, value, strong] of totals) {
    right(label, cols.unit, strong ? 11 : 9.5, strong ? bold : regular, strong ? ink : muted);
    right(d.money(value), cols.amount, strong ? 12 : 9.5, strong ? bold : regular);
    y -= strong ? 18 : 14;
  }
  if (d.references.length) {
    y -= 4;
    text(`${d.labels.paymentRef}: ${d.references.join(", ")}`, M, 9, regular, muted);
    y -= 14;
  }

  // The status, stamped large (UNPAID in red, PAID in green…).
  const tone = { red: rgb(0.78, 0.13, 0.13), green: rgb(0.06, 0.55, 0.3), amber: rgb(0.75, 0.45, 0.02), grey: rgb(0.45, 0.48, 0.52) }[d.stampTone];
  const stamp = plain(d.stampLabel.toUpperCase());
  const size = 34;
  const sw = bold.widthOfTextAtSize(stamp, size);
  page.drawRectangle({ x: 595 - M - sw - 30, y: 150, width: sw + 24, height: size + 14, borderColor: tone, borderWidth: 3, rotate: degrees(-8), opacity: 0 });
  page.drawText(stamp, { x: 595 - M - sw - 18, y: 160, size, font: bold, color: tone, rotate: degrees(-8) });
  page.drawText(plain(`${d.labels.status}: ${d.stampLabel}`), { x: M, y: 160, size: 10, font: bold, color: tone });

  if (d.business.footer) page.drawText(fit(d.business.footer, 8.5, regular, W), { x: M, y: M, size: 8.5, font: regular, color: muted });
  return doc.save();
}
