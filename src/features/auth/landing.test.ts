import { describe, expect, it } from "vitest";
import { landingAfterLogin } from "./landing";

describe("landingAfterLogin", () => {
  it("always sends staff to the admin dashboard (or the admin page they asked for)", () => {
    expect(landingAfterLogin("/", "ADMIN")).toBe("/admin");
    expect(landingAfterLogin("/profile", "ADMIN")).toBe("/admin");
    expect(landingAfterLogin("/bookings/SR-ABCDEF", "ADMIN")).toBe("/admin");
    expect(landingAfterLogin("/admin/users", "ADMIN")).toBe("/admin/users");
  });

  it("sends everyone else where they were heading", () => {
    expect(landingAfterLogin("/", "USER")).toBe("/");
    expect(landingAfterLogin("/profile", undefined)).toBe("/profile");
  });
});
