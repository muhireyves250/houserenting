import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

const asMap = (isProd: boolean) => Object.fromEntries(securityHeaders({ isProd }).map((h) => [h.key, h.value]));

describe("securityHeaders", () => {
  it("forbids framing, sniffing and leaking referrers", () => {
    const h = asMap(true);
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(h["Content-Security-Policy"]).toContain("object-src 'none'");
  });

  it("allows Cloudinary and Unsplash (demo) images", () => {
    expect(asMap(true)["Content-Security-Policy"]).toContain("img-src 'self' data: blob: https://res.cloudinary.com https://images.unsplash.com https://tile.openstreetmap.org");
  });

  it("only sends HSTS and forbids eval in production", () => {
    expect(asMap(true)["Strict-Transport-Security"]).toMatch(/max-age=63072000/);
    expect(asMap(true)["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
    expect(asMap(false)["Strict-Transport-Security"]).toBeUndefined();
    expect(asMap(false)["Content-Security-Policy"]).toContain("'unsafe-eval'");
  });

  it("allows the hero background video host", () => {
    expect(asMap(true)["Content-Security-Policy"]).toContain("media-src 'self' https://assets.mixkit.co https://res.cloudinary.com");
  });
});
