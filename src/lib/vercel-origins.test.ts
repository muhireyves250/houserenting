import { describe, expect, it } from "vitest";
import { vercelOrigins } from "./vercel-origins";

describe("vercelOrigins", () => {
  it("trusts the production, branch and deployment addresses Vercel provides", () => {
    expect(
      vercelOrigins({ VERCEL_PROJECT_PRODUCTION_URL: "houserenting.vercel.app", VERCEL_URL: "houserenting-abc123.vercel.app" }),
    ).toEqual(["https://houserenting.vercel.app", "https://houserenting-abc123.vercel.app"]);
    expect(vercelOrigins({})).toEqual([]);
  });
});
