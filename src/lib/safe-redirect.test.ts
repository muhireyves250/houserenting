import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it.each(["/profile", "/search?mode=long&location=Kigali", "/bookings/abc"])("keeps same-site path %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "profile",
    "",
    "/ok\nSet-Cookie: x",
    undefined,
    null,
    42,
    ["/profile"],
  ])("falls back for %j", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("supports a custom fallback", () => {
    expect(safeNextPath("//evil.com", "/profile")).toBe("/profile");
  });
});
