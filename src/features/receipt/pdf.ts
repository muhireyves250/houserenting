import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { PaymentReceipt } from "./payment-receipt";

/** The standard PDF fonts only know Western characters: swap the few typographic ones we use and drop the rest. */
const plain = (s: string) =>
  s
    .replace(/[   ]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/·/g, "-")
    .replace(/[^\x20-\x7E¡-ÿ]/g, "");

/** A one-page A5 PDF of a payment's receipt (same content as the printable page). */
export async function receiptPdf(r: PaymentReceipt): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(plain(`${r.title} ${r.booking.reference}`));
  doc.setAuthor(plain(r.businessName));
  const page = doc.addPage([420, 595]);
  const [regular, bold] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
  ]);
  const ink = rgb(0.09, 0.1, 0.13);
  const muted = rgb(0.42, 0.45, 0.5);
  const line = rgb(0.86, 0.87, 0.9);
  const { width } = page.getSize();
  const margin = 32;
  let y = 595 - 44;

  const centre = (text: string, size: number, font: PDFFont, color = ink) => {
    const s = plain(text);
    page.drawText(s, {
      x: (width - font.widthOfTextAtSize(s, size)) / 2,
      y,
      size,
      font,
      color,
    });
  };
  /** Cuts text to fit a width (long place names, emails). */
  const fit = (text: string, size: number, font: PDFFont, max: number) => {
    let s = plain(text);
    while (s.length > 1 && font.widthOfTextAtSize(s, size) > max)
      s = s.slice(0, -2);
    return s === plain(text) ? s : `${s.trimEnd()}...`;
  };
  const rule = (dashed = false) =>
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: dashed ? 0.8 : 0.6,
      color: line,
      dashArray: dashed ? [3, 3] : undefined,
    });

  centre(r.businessName, 16, bold);
  y -= 16;
  for (const l of r.headerLines) {
    centre(l, 9, regular, muted);
    y -= 12;
  }
  y -= 8;
  rule(true);
  y -= 18;
  centre(r.title.toUpperCase(), 12, bold);
  y -= 12;
  rule(true);
  y -= 22;

  const half = (width - margin * 2) / 2;
  for (const [label, value] of r.rows) {
    page.drawText(fit(label, 9.5, regular, half - 8), {
      x: margin,
      y,
      size: 9.5,
      font: regular,
      color: muted,
    });
    const v = fit(value, 9.5, bold, half + 20);
    page.drawText(v, {
      x: width - margin - bold.widthOfTextAtSize(v, 9.5),
      y,
      size: 9.5,
      font: bold,
      color: ink,
    });
    y -= 9;
    rule();
    y -= 15;
  }
  y -= 4;
  page.drawLine({
    start: { x: margin, y: y + 12 },
    end: { x: width - margin, y: y + 12 },
    thickness: 1.4,
    color: ink,
  });
  y -= 6;
  page.drawText(plain(r.amountLabel), {
    x: margin,
    y,
    size: 11,
    font: bold,
    color: ink,
  });
  const amount = plain(r.amount);
  page.drawText(amount, {
    x: width - margin - bold.widthOfTextAtSize(amount, 16),
    y: y - 2,
    size: 16,
    font: bold,
    color: ink,
  });

  if (r.footer) {
    y -= 40;
    rule(true);
    y -= 16;
    for (const l of plain(r.footer).match(/.{1,70}(\s|$)/g) ?? []) {
      centre(l.trim(), 8.5, regular, muted);
      y -= 11;
    }
  }
  return doc.save();
}
