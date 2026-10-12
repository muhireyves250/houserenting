import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import { authErrorKey } from "@/features/auth/errors";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { MemoryMailer, setMailerForTests, type Mailer } from "@/lib/mailer";
import { resetDb } from "@/test/db";

const BASE = process.env.BETTER_AUTH_URL!;
const PASSWORD = "umuganda-blue-lake-42";
let mailer: MemoryMailer;

async function errorOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    const err = e as { body?: { code?: string }; statusCode?: number };
    return { code: err.body?.code, status: err.statusCode };
  }
  throw new Error("expected the call to fail");
}

async function lastMailTo(email: string) {
  await vi.waitFor(() => expect(mailer.sent.some((m) => m.to === email)).toBe(true));
  return mailer.sent.filter((m) => m.to === email).at(-1)!;
}

const linkIn = (text: string) => text.match(/https?:\/\/\S+/)![0];

async function signUp(email: string, locale = "en", password = PASSWORD) {
  return auth.api.signUpEmail({ body: { name: "Alona", email, password, locale, callbackURL: `/${locale}/verified` } });
}

async function signUpAndVerify(email: string) {
  await signUp(email);
  const mail = await lastMailTo(email);
  await auth.handler(new Request(linkIn(mail.text)));
}

beforeEach(async () => {
  await resetDb();
  mailer = new MemoryMailer();
  setMailerForTests(mailer);
});

describe("sign up", () => {
  it("creates an unverified user with defaults and the chosen locale", async () => {
    await signUp("new@example.com", "rw");
    const user = await db.user.findUniqueOrThrow({ where: { email: "new@example.com" } });
    expect(user).toMatchObject({ emailVerified: false, locale: "rw", role: "USER", isHost: false });
  });

  it("stores an argon2id hash, never the plain password", async () => {
    await signUp("hash@example.com");
    const account = await db.account.findFirstOrThrow({ where: { user: { email: "hash@example.com" } } });
    expect(account.password?.startsWith("$argon2id$")).toBe(true);
    expect(account.password).not.toContain(PASSWORD);
  });

  it("sends the verification email in the user's language with a link to this app", async () => {
    await signUp("rw@example.com", "rw");
    const mail = await lastMailTo("rw@example.com");
    expect(mail.subject).toBe("Emeza imeyili yawe kuri Space Rental");
    expect(linkIn(mail.text).startsWith(`${BASE}/api/auth/verify-email?token=`)).toBe(true);
  });

  it("rejects common passwords", async () => {
    expect(authErrorKey(await errorOf(signUp("common@example.com", "en", "password123")))).toBe("passwordCommon");
    expect(await db.user.count()).toBe(0);
  });

  it("never creates a second account for the same email", async () => {
    await signUp("dupe@example.com");
    await signUp("dupe@example.com").catch(() => undefined);
    expect(await db.user.count({ where: { email: "dupe@example.com" } })).toBe(1);
  });

  it("emails the existing owner instead of leaving a duplicate sign-up waiting for nothing", async () => {
    await signUp("owner@example.com", "fr");
    mailer.clear();
    await signUp("owner@example.com", "en").catch(() => undefined);
    const mail = await lastMailTo("owner@example.com");
    expect(mail.subject).toBe("Vous avez déjà un compte Space Rental");
    expect(linkIn(mail.text)).toBe(`${BASE}/fr/login`);
  });

  it("still succeeds when the email provider is down", async () => {
    const failing: Mailer = { send: () => Promise.reject(new Error("SMTP down")) };
    setMailerForTests(failing);
    const logged = vi.spyOn(logger, "error").mockImplementation(() => undefined);
    await expect(signUp("outage@example.com")).resolves.toBeTruthy();
    expect(await db.user.count({ where: { email: "outage@example.com" } })).toBe(1);
    // The failure is logged, not surfaced to the user.
    await vi.waitFor(() => expect(logged).toHaveBeenCalledWith(expect.objectContaining({ kind: "verify" }), "auth email failed"));
    logged.mockRestore();
  });
});

describe("sign in", () => {
  it("is refused until the email is verified", async () => {
    await signUp("unverified@example.com");
    const error = await errorOf(auth.api.signInEmail({ body: { email: "unverified@example.com", password: PASSWORD } }));
    expect(authErrorKey(error)).toBe("notVerified");
  });

  it("works after following the verification link", async () => {
    await signUpAndVerify("ok@example.com");
    expect((await db.user.findUniqueOrThrow({ where: { email: "ok@example.com" } })).emailVerified).toBe(true);
    const result = await auth.api.signInEmail({ body: { email: "ok@example.com", password: PASSWORD } });
    expect(result.user.email).toBe("ok@example.com");
  });

  it("rejects a wrong password", async () => {
    await signUpAndVerify("wrong@example.com");
    const error = await errorOf(auth.api.signInEmail({ body: { email: "wrong@example.com", password: "not-the-password" } }));
    expect(authErrorKey(error)).toBe("invalidCredentials");
  });

  it("rate-limits repeated attempts from one IP (6th within a minute gets 429)", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await auth.handler(
        new Request(`${BASE}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": "203.0.113.7" },
          body: JSON.stringify({ email: "nobody@example.com", password: "whatever-123" }),
        }),
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s !== 429)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});

describe("password reset", () => {
  it("replaces the password using the emailed token", async () => {
    await signUpAndVerify("reset@example.com");
    mailer.clear();
    await auth.api.requestPasswordReset({ body: { email: "reset@example.com", redirectTo: "/en/reset-password" } });
    const mail = await lastMailTo("reset@example.com");
    expect(mail.subject).toBe("Reset your Space Rental password");
    const token = new URL(linkIn(mail.text)).pathname.split("/").at(-1)!;

    await auth.api.resetPassword({ body: { token, newPassword: "new-river-kivu-77" } });

    await expect(auth.api.signInEmail({ body: { email: "reset@example.com", password: "new-river-kivu-77" } })).resolves.toBeTruthy();
    expect(authErrorKey(await errorOf(auth.api.signInEmail({ body: { email: "reset@example.com", password: PASSWORD } })))).toBe(
      "invalidCredentials",
    );
  });

  it("rejects common new passwords", async () => {
    await signUpAndVerify("reset2@example.com");
    mailer.clear();
    await auth.api.requestPasswordReset({ body: { email: "reset2@example.com", redirectTo: "/en/reset-password" } });
    const token = new URL(linkIn((await lastMailTo("reset2@example.com")).text)).pathname.split("/").at(-1)!;
    expect(authErrorKey(await errorOf(auth.api.resetPassword({ body: { token, newPassword: "password123" } })))).toBe("passwordCommon");
  });

  it("does not reveal whether an email exists", async () => {
    await expect(
      auth.api.requestPasswordReset({ body: { email: "ghost@example.com", redirectTo: "/en/reset-password" } }),
    ).resolves.toBeTruthy();
    await new Promise((r) => setTimeout(r, 200));
    expect(mailer.sent).toHaveLength(0);
  });
});
