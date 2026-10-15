import "server-only";
import { after } from "next/server";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { signPayload } from "./signature";

export type CollectionRequest = { bookingReference: string; amount: number; currency: string; method: "mtn" | "airtel"; phone: string };

/** A mobile money provider: asks the guest's phone to approve a payment; the result arrives later as a signed callback. */
export interface PaymentProvider {
  name: string;
  requestPayment(request: CollectionRequest): Promise<{ ok: true } | { ok: false; error: "providerDown" }>;
}

/**
 * Test-only provider: pretends the guest approved, then sends a correctly signed "payment.succeeded" callback to this
 * site a few seconds later, so the whole flow can be seen end to end. Never available in production.
 */
const sandbox: PaymentProvider = {
  name: "sandbox",
  async requestPayment(request) {
    const { PAYMENT_WEBHOOK_SECRET: secret, BETTER_AUTH_URL: site } = getEnv();
    if (!secret) return { ok: false, error: "providerDown" };
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const body = JSON.stringify({
        eventId: `sandbox-${request.bookingReference}-${Date.now()}`,
        provider: "sandbox",
        type: "payment.succeeded",
        bookingReference: request.bookingReference,
        amount: request.amount,
        currency: request.currency,
        providerReference: `SBX-${Date.now().toString(36).toUpperCase()}`,
      });
      const signature = signPayload(body, secret, Math.floor(Date.now() / 1000));
      await fetch(`${site}/api/v1/payments/callback`, { method: "POST", headers: { "content-type": "application/json", "x-payment-signature": signature }, body }).catch(
        (err: unknown) => logger.error({ err }, "sandbox callback failed"),
      );
    });
    return { ok: true };
  },
};

/** The configured provider, or null while payments aren't connected. A real provider adapter plugs in here. */
export function getPaymentProvider(): PaymentProvider | null {
  const { PAYMENT_PROVIDER: name, PAYMENT_WEBHOOK_SECRET: secret } = getEnv();
  if (!secret) return null;
  if (name === "sandbox" && process.env.NODE_ENV !== "production") return sandbox;
  return null;
}
