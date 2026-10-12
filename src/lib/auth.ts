import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/features/auth/constants";
import { buildExistingAccountEmail, buildPasswordResetEmail, buildVerificationEmail } from "@/features/auth/emails";
import { hashPassword, isCommonPassword, verifyPassword } from "@/features/auth/password";
import { toAppLocale } from "@/i18n/routing";
import { runInBackground } from "@/lib/background";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getMailer, type MailMessage } from "@/lib/mailer";

const env = getEnv();

// Never rejects: a mail outage must not fail sign-up; the failure is logged instead.
// Better Auth hands the returned promise to `advanced.backgroundTasks` (Next's `after`).
function sendSafely(message: MailMessage, kind: string): Promise<void> {
  return getMailer()
    .send(message)
    .catch((err: unknown) => {
      logger.error({ err, kind }, "auth email failed");
    });
}

const localeOf = (user: unknown) => (user as { locale?: string }).locale;

export const auth = betterAuth({
  appName: "Space Rental",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  user: {
    additionalFields: {
      phone: { type: "string", required: false, input: false },
      locale: { type: "string", required: false, defaultValue: "en", input: true },
      role: { type: "string", required: false, defaultValue: "USER", input: false },
      isHost: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: PASSWORD_MIN,
    maxPasswordLength: PASSWORD_MAX,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
    sendResetPassword: async ({ user, url }) => {
      await sendSafely(buildPasswordResetEmail({ to: user.email, name: user.name, url, locale: localeOf(user) }), "reset");
    },
    // With required verification, Better Auth answers a duplicate sign-up with a generic success;
    // tell the real owner so they aren't left waiting for a verification email.
    onExistingUserSignUp: async ({ user }) => {
      const locale = toAppLocale(localeOf(user));
      const url = `${env.BETTER_AUTH_URL}/${locale}/login`;
      await sendSafely(buildExistingAccountEmail({ to: user.email, name: user.name, url, locale }), "existing");
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendSafely(buildVerificationEmail({ to: user.email, name: user.name, url, locale: localeOf(user) }), "verify");
    },
  },
  rateLimit: {
    enabled: env.RATE_LIMIT_ENABLED,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const candidate =
        ctx.path === "/sign-up/email" ? ctx.body?.password : ctx.path === "/reset-password" ? ctx.body?.newPassword : undefined;
      if (typeof candidate === "string" && isCommonPassword(candidate)) {
        throw new APIError("BAD_REQUEST", { code: "PASSWORD_TOO_COMMON", message: "Password is too common" });
      }
    }),
  },
  advanced: {
    backgroundTasks: { handler: runInBackground },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
export type SessionUser = AuthSession["user"];
