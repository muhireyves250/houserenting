import { describe, expect, it } from "vitest";
import { isBookingReference, newBookingReference } from "./reference";

describe("booking references", () => {
  it("look like SR- and six easy-to-read characters", () => {
    for (let i = 0; i < 50; i++) {
      const ref = newBookingReference();
      expect(ref).toMatch(/^SR-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
      expect(isBookingReference(ref)).toBe(true);
    }
  });

  it("are not predictable in sequence", () => {
    expect(new Set(Array.from({ length: 200 }, newBookingReference)).size).toBe(200);
  });

  it("rejects anything else", () => {
    for (const bad of ["", "SR-12345", "SR-ABCDEFG", "sr-abcdef", "SR-ABCDE0", "../x", "SR-ABCDEF "]) {
      expect(isBookingReference(bad)).toBe(false);
    }
  });
});
