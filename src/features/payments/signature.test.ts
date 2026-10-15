import { describe, expect, it } from "vitest";
import { signPayload, verifySignature } from "./signature";

const secret = "whsec_test_0123456789";
const body = JSON.stringify({ eventId: "evt_1", type: "payment.succeeded" });
const now = new Date("2026-10-15T10:00:00Z");
const t = Math.floor(now.getTime() / 1000);

describe("payment callback signatures", () => {
  it("accepts a fresh, correctly signed callback", () => {
    expect(verifySignature(body, signPayload(body, secret, t), secret, now)).toEqual({ ok: true });
  });

  it("refuses a changed body, a wrong secret, a missing or malformed header", () => {
    const header = signPayload(body, secret, t);
    expect(verifySignature(body.replace("succeeded", "failed"), header, secret, now)).toEqual({ ok: false, reason: "mismatch" });
    expect(verifySignature(body, signPayload(body, "other", t), secret, now)).toEqual({ ok: false, reason: "mismatch" });
    expect(verifySignature(body, null, secret, now)).toEqual({ ok: false, reason: "missing" });
    expect(verifySignature(body, "t=abc,v1=zz", secret, now)).toEqual({ ok: false, reason: "malformed" });
  });

  it("refuses an old callback being replayed", () => {
    expect(verifySignature(body, signPayload(body, secret, t - 600), secret, now)).toEqual({ ok: false, reason: "stale" });
  });
});
