import { describe, expect, it } from "vitest";
import { landingAfterLogin } from "./landing";

describe("landingAfterLogin", () => {
  it("always sends staff to the admin dashboard (or the admin page they asked for)", () => {
    expect(landingAfterLogin("/", "ADMIN")).toBe("/admin");
    expect(landingAfterLogin("/profile", "ADMIN")).toBe("/admin");
    expect(landingAfterLogin("/bookings/SR-ABCDEF", "ADMIN")).toBe("/admin");
    expect(landingAfterLogin("/admin/users", "ADMIN")).toBe("/admin/users");
  });

  it("always sends house owners to their dashboard (or the owner page they asked for)", () => {
    expect(landingAfterLogin("/", "USER", true)).toBe("/host");
    expect(landingAfterLogin("/bookings/SR-ABCDEF", "USER", true)).toBe("/host");
    expect(landingAfterLogin("/host/payout", "USER", true)).toBe("/host/payout");
    expect(landingAfterLogin("/", "ADMIN", true)).toBe("/admin");
  });

  it("sends everyone else where they were heading (their work dashboard, if any, when no page was asked for)", () => {
    expect(landingAfterLogin("/", "USER")).toBe("/work");
    expect(landingAfterLogin("/profile", undefined)).toBe("/profile");
  });
});
