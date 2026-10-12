import { describe, expect, it } from "vitest";
import { firstErrors } from "@/lib/zod-errors";
import { normalizePhone, profileSchema } from "./schemas";

describe("normalizePhone", () => {
  it.each([
    ["0788 123 456", "+250788123456"],
    ["0788-123-456", "+250788123456"],
    ["+250 788 123 456", "+250788123456"],
    ["250788123456", "+250788123456"],
    ["00250788123456", "+250788123456"],
    ["+33 6 12 34 56 78", "+33612345678"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "12345", "0788", "abc", "+0123456789", "07881234567890123"])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe("profileSchema", () => {
  it("normalizes fields and treats an empty phone as no phone", () => {
    expect(profileSchema.parse({ name: " Alona ", phone: "", locale: "rw" })).toEqual({ name: "Alona", phone: null, locale: "rw" });
    expect(profileSchema.parse({ name: "A", phone: "0788 123 456", locale: "en" }).phone).toBe("+250788123456");
  });

  it("reports message keys per field", () => {
    const result = profileSchema.safeParse({ name: "", phone: "12", locale: "de" });
    expect(firstErrors(result.error!)).toEqual({ name: "nameRequired", phone: "phoneInvalid", locale: "localeInvalid" });
  });
});
