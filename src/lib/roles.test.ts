import { describe, expect, it } from "vitest";
import { canStaff, isAdmin, STAFF_AREAS, staffAreasOf } from "./roles";

describe("staff areas", () => {
  it("super admins manage every area", () => {
    expect(staffAreasOf({ role: "SUPER_ADMIN", staffAreas: [] })).toEqual([...STAFF_AREAS]);
  });

  it("admins manage only the areas they were given", () => {
    const laundry = { role: "ADMIN", staffAreas: ["laundry", "food"] };
    expect(canStaff(laundry, "laundry")).toBe(true);
    expect(canStaff(laundry, "food")).toBe(true);
    expect(canStaff(laundry, "bookings")).toBe(false);
    expect(canStaff(laundry, "money")).toBe(false);
    expect(staffAreasOf(laundry)).toEqual(["food", "laundry"]);
    expect(isAdmin(laundry)).toBe(true);
  });

  it("an admin with no areas sees only the overview", () => {
    expect(staffAreasOf({ role: "ADMIN", staffAreas: [] })).toEqual([]);
  });

  it("customers and hosts never manage anything, whatever is stored", () => {
    expect(canStaff({ role: "USER", staffAreas: ["money"] }, "money")).toBe(false);
    expect(canStaff(null, "money")).toBe(false);
  });

  it("staff built inside the server without areas count as full staff", () => {
    expect(canStaff({ role: "ADMIN" }, "money")).toBe(true);
  });
});
