import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "@/lib/auth";

/**
 * Where the auth API lives. In the browser: this site. While pages render on the server: BETTER_AUTH_URL, tidied the
 * same way as the server config (hosting dashboards often hold it without "https://", which the client would reject,
 * failing every page that signs people in or out).
 */
export function authBaseURL(raw: string | undefined = process.env.BETTER_AUTH_URL, origin?: string): string {
  if (origin) return origin;
  const url = (raw ?? "").trim().replace(/^["']|["']$/g, "").trim();
  if (!url) return "http://localhost:3000";
  return (/^https?:\/\//i.test(url) ? url : `https://${url}`).replace(/\/+$/, "");
}

export const authClient = createAuthClient({
  baseURL: authBaseURL(process.env.BETTER_AUTH_URL, typeof window === "undefined" ? undefined : window.location.origin),
  plugins: [inferAdditionalFields<typeof auth>()],
});
