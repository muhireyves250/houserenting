import { describe, expect, it } from "vitest";
import { SENTRY_DATA_COLLECTION } from "./sentry-options";

describe("Sentry data collection policy", () => {
  it("never sends request bodies (passwords), cookies (sessions) or query strings (reset tokens)", () => {
    expect(SENTRY_DATA_COLLECTION.httpBodies).toEqual([]);
    expect(SENTRY_DATA_COLLECTION.cookies).toBe(false);
    expect(SENTRY_DATA_COLLECTION.urlQueryParams).toBe(false);
  });

  it("does not attach user identity or database query data", () => {
    expect(SENTRY_DATA_COLLECTION.userInfo).toBe(false);
    expect(SENTRY_DATA_COLLECTION.databaseQueryData).toBe(false);
  });

  it("collects only harmless request headers", () => {
    expect(SENTRY_DATA_COLLECTION.httpHeaders).toEqual({ request: { allow: ["user-agent", "accept-language"] }, response: false });
  });
});
