import { randomInt } from "node:crypto";

// No 0/O, 1/I/L: easy to read out over the phone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LENGTH = 6;
const PATTERN = new RegExp(`^SR-[${ALPHABET}]{${LENGTH}}$`);

/** Random booking code such as "SR-7K2M9Q" (about 887 million possibilities). */
export function newBookingReference(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `SR-${code}`;
}

export function isBookingReference(value: string): boolean {
  return PATTERN.test(value);
}
