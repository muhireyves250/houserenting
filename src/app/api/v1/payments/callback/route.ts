import { NextResponse, type NextRequest } from "next/server";
import { callbackBody, handlePaymentCallback } from "@/features/payments/service";
import { verifySignature } from "@/features/payments/signature";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Payment provider callback. Only a correctly signed, recent request is processed; each event is applied once.
 * Answers 200 for anything handled (including repeats) so the provider stops retrying.
 */
export async function POST(request: NextRequest) {
  const secret = getEnv().PAYMENT_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "payments not configured" }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 20_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  const check = verifySignature(raw, request.headers.get("x-payment-signature"), secret);
  if (!check.ok) {
    logger.warn({ reason: check.reason }, "payment callback refused");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = callbackBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const outcome = await handlePaymentCallback(parsed.data);
  return NextResponse.json({ received: true, outcome });
}
