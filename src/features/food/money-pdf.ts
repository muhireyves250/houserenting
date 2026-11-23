import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type MoneyDoc = {
  title: string;
  /** Lines under the title (restaurant, day or order, issued…). */
  meta: string[];
  head: string[];
  /** Column widths (points); the last columns are amounts, right-aligned. */
  widths: number[];
  rows: string[][];
  /** Label and value lines at the bottom (the last one in bold). */
  totals: [string, string][];
  footer: string;
};

const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?");

/** A restaurant's money document (daily report or order receipt) as a simple, printable A4 PDF. */
export async function moneyPdf(d: MoneyDoc, rightFrom: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595;
  const H = 842;
  const M = 40;
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const fit = (s: string, w: number, f = font) => {
    let t = clean(s);
    while (t && f.widthOfTextAtSize(t, 9.5) > w) t = t.slice(0, -1);
    return t;
  };
  const row = (cells: string[], f = font) => {
    let x = M + 6;
    cells.forEach((c, i) => {
      const w = d.widths[i]!;
      const text = fit(c, w - 8, f);
      const at = i >= rightFrom ? x + w - 8 - f.widthOfTextAtSize(text, 9.5) : x;
      page.drawText(text, { x: at, y, size: 9.5, font: f });
      x += w;
    });
  };
  page.drawText("VIIPA", { x: M, y: y - 4, size: 11, font: bold, color: rgb(0, 0.34, 0.72) });
  page.drawText(clean(d.title), { x: M, y: y - 26, size: 18, font: bold });
  y -= 46;
  for (const m of d.meta) {
    page.drawText(clean(m), { x: M, y, size: 10, font, color: rgb(0.35, 0.35, 0.4) });
    y -= 14;
  }
  y -= 10;
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: rgb(0.93, 0.95, 0.98) });
    row(d.head, bold);
    y -= 22;
  };
  header();
  d.rows.forEach((r, i) => {
    if (y < M + 80) {
      page = pdf.addPage([W, H]);
      y = H - M;
      header();
    }
    if (i % 2 === 1) page.drawRectangle({ x: M, y: y - 5, width: W - 2 * M, height: 16, color: rgb(0.975, 0.975, 0.985) });
    row(r);
    y -= 16;
  });
  y -= 8;
  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.6, color: rgb(0.8, 0.8, 0.85) });
  d.totals.forEach(([label, value], i) => {
    const f = i === d.totals.length - 1 ? bold : font;
    y -= 16;
    page.drawText(clean(label), { x: W - M - 250, y, size: 10.5, font: f });
    page.drawText(clean(value), { x: W - M - 6 - f.widthOfTextAtSize(clean(value), 10.5), y, size: 10.5, font: f });
  });
  for (const p of pdf.getPages()) p.drawText(clean(d.footer), { x: M, y: 22, size: 8, font, color: rgb(0.5, 0.5, 0.55) });
  return pdf.save();
}
