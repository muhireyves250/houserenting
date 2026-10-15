import { describe, expect, it } from "vitest";
import { landingAfterLogin } from "./landing";

describe("landingAfterLogin", () => {
  it("sends staff with no particular destination to the dashboard", () => {
    expect(landingAfterLogin("/", "ADMIN")).toBe("/admin");
    expect(landingAfterLogin("/profile", "ADMIN")).toBe("/admin");
  });

  it("keeps an explicit destination, and never redirects other people", () => {
    expect(landingAfterLogin("/bookings/SR-ABCDEF", "ADMIN")).toBe("/bookings/SR-ABCDEF");
    expect(landingAfterLogin("/", "USER")).toBe("/");
    expect(landingAfterLogin("/profile", undefined)).toBe("/profile");
  });
});
