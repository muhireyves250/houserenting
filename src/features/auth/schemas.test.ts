import { describe, expect, it } from "vitest";
import { firstErrors } from "@/lib/zod-errors";
import { loginSchema, signupSchema } from "./schemas";

describe("signupSchema", () => {
  it("trims the name and lowercases the email", () => {
    const parsed = signupSchema.parse({ name: "  Alona ", email: " Alona@Example.COM ", password: "longenough" });
    expect(parsed).toEqual({ name: "Alona", email: "alona@example.com", password: "longenough" });
  });

  it("reports one message key per field", () => {
    const result = signupSchema.safeParse({ name: " ", email: "nope", password: "short" });
    expect(result.success).toBe(false);
    expect(firstErrors(result.error!)).toEqual({ name: "nameRequired", email: "emailInvalid", password: "passwordShort" });
  });

  it("rejects names over 80 characters and passwords over 128", () => {
    const result = signupSchema.safeParse({ name: "a".repeat(81), email: "a@b.co", password: "x".repeat(129) });
    expect(firstErrors(result.error!)).toEqual({ name: "nameTooLong", password: "passwordLong" });
  });
});

describe("loginSchema", () => {
  it("requires a password", () => {
    const result = loginSchema.safeParse({ email: "a@b.co", password: "" });
    expect(firstErrors(result.error!)).toEqual({ password: "invalidCredentials" });
  });
});
