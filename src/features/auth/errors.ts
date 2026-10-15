import type { Messages } from "@/i18n/messages";

export type AuthErrorKey = keyof Messages["Auth"]["errors"];

export function authErrorKey(error?: { code?: string | null; status?: number | null } | null): AuthErrorKey {
  if (!error) return "generic";
  if (error.status === 429) return "tooMany";
  const code = error.code ?? "";
  // Only reachable if email verification is ever turned off: with it on, Better Auth hides duplicates.
  if (code.startsWith("USER_ALREADY_EXISTS")) return "emailTaken";
  if (code === "INVALID_EMAIL_OR_PASSWORD" || code === "INVALID_PASSWORD" || code === "INVALID_EMAIL") return "invalidCredentials";
  if (code === "EMAIL_NOT_VERIFIED") return "notVerified";
  if (code === "ACCOUNT_SUSPENDED") return "suspended";
  if (code === "PASSWORD_TOO_SHORT") return "passwordShort";
  if (code === "PASSWORD_TOO_LONG") return "passwordLong";
  if (code === "PASSWORD_TOO_COMMON") return "passwordCommon";
  if (code === "INVALID_TOKEN" || code === "TOKEN_EXPIRED") return "invalidToken";
  return "generic";
}

export function fieldForAuthError(key: AuthErrorKey): "name" | "email" | "password" | "form" {
  if (key.startsWith("password")) return "password";
  if (key === "emailTaken" || key === "emailInvalid") return "email";
  if (key.startsWith("name")) return "name";
  return "form";
}
