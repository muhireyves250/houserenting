// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashPassword, isCommonPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("produces an argon2id hash that verifies only the right password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "correct horse battery")).toBe(true);
    expect(await verifyPassword(hash, "wrong horse battery")).toBe(false);
  });
});

describe("isCommonPassword", () => {
  it("flags common passwords regardless of case and surrounding spaces", () => {
    expect(isCommonPassword("password123")).toBe(true);
    expect(isCommonPassword("  PASSWORD123 ")).toBe(true);
    expect(isCommonPassword("kigali123")).toBe(true);
  });
  it("accepts uncommon passwords", () => {
    expect(isCommonPassword("blue-lake-umuganda-42")).toBe(false);
  });
});
