import { describe, expect, it } from "vitest";
import { buildExistingAccountEmail, buildPasswordResetEmail, buildVerificationEmail } from "./emails";

describe("auth emails", () => {
  const url = "https://app.test/api/auth/verify-email?token=abc&callbackURL=%2Fen%2Fverified";

  it("builds a verification email in the user's locale", () => {
    const mail = buildVerificationEmail({ to: "a@example.com", name: "Alona", url, locale: "fr" });
    expect(mail.to).toBe("a@example.com");
    expect(mail.subject).toBe("Confirmez votre e-mail pour Space Rental");
    expect(mail.text).toContain("Bonjour Alona,");
    expect(mail.text).toContain(url);
  });

  it("falls back to English for unknown or missing locales", () => {
    expect(buildVerificationEmail({ to: "a@x.co", name: "A", url, locale: "de" }).subject).toBe("Confirm your email for Space Rental");
    expect(buildPasswordResetEmail({ to: "a@x.co", name: "A", url }).subject).toBe("Reset your Space Rental password");
  });

  it("escapes user-controlled text and URLs in HTML", () => {
    const mail = buildVerificationEmail({ to: "a@x.co", name: '<img src=x onerror="alert(1)">', url, locale: "en" });
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(mail.html).toContain('href="https://app.test/api/auth/verify-email?token=abc&amp;callbackURL=%2Fen%2Fverified"');
  });

  it("builds the 'you already have an account' email with a link to log in", () => {
    const mail = buildExistingAccountEmail({ to: "a@x.co", name: "Alona", url: "https://app.test/rw/login", locale: "rw" });
    expect(mail.subject).toBe("Usanzwe ufite konti kuri Space Rental");
    expect(mail.text).toContain("https://app.test/rw/login");
  });
});
