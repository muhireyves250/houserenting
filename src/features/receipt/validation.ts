import { z } from "zod";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

/** What staff can put on guests' receipts; every field is optional (empty = not printed). */
export const receiptInput = z.object({
  businessName: text(80),
  address: text(160),
  phone: text(40),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: "email" })
    .transform((v) => (v === "" ? null : v)),
  tin: text(40),
  footer: text(300),
});
export type ReceiptInput = z.input<typeof receiptInput>;
export type ReceiptDetails = z.output<typeof receiptInput>;
