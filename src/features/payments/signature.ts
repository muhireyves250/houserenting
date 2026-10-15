import { createHmac, timingSafeEqual } from "node:crypto";

/** How old a callback may be; older ones are refused so a captured request can't be replayed later. */
export const MAX_AGE_SECONDS = 5 * 60;

/** Signature header: "t=<unix seconds>,v1=<hex HMAC-SHA256 of `${t}.${rawBody}`>". */
export function signPayload(rawBody: string, secret: string, timestamp: number): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

export type SignatureCheck = { ok: true } | { ok: false; reason: "missing" | "malformed" | "stale" | "mismatch" };

/** Checks a callback really comes from the payment provider (shared secret) and is recent. Constant-time compare. */
export function verifySignature(rawBody: string, header: string | null, secret: string, now: Date = new Date()): SignatureCheck {
  if (!header) return { ok: false, reason: "missing" };
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const timestamp = Number(parts.t);
  const given = parts.v1;
  if (!Number.isInteger(timestamp) || !given || !/^[0-9a-f]{64}$/.test(given)) return { ok: false, reason: "malformed" };
  if (Math.abs(now.getTime() / 1000 - timestamp) > MAX_AGE_SECONDS) return { ok: false, reason: "stale" };
  const expected = signPayload(rawBody, secret, timestamp).split("v1=")[1]!;
  const ok = timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(given, "hex"));
  return ok ? { ok: true } : { ok: false, reason: "mismatch" };
}
