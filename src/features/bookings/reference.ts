import { randomInt } from "node:crypto";

// No 0/O, 1/I/L: easy to read out over the phone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LENGTH = 6;

/** Random code such as "SR-7K2M9Q" (about 887 million possibilities per prefix). */
export function newReference(prefix: string): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `${prefix}-${code}`;
}

export function isReference(prefix: string, value: string): boolean {
  return new RegExp(`^${prefix}-[${ALPHABET}]{${LENGTH}}$`).test(value);
}

/** Bookings: "SR-…". */
export const newBookingReference = () => newReference("SR");
export const isBookingReference = (value: string) => isReference("SR", value);

/** Support requests: "HL-…" (help). */
export const newTicketReference = () => newReference("HL");
export const isTicketReference = (value: string) => isReference("HL", value);
