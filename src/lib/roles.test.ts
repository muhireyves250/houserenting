import { describe, expect, it } from "vitest";
import { canStaff, isAdmin, STAFF_AREAS, staffAreasOf } from "./roles";

describe("staff areas", () => {
  it("super admins manage every area", () => {
    expect(staffAreasOf({ role: "SUPER_ADMIN", staffAreas: [] })).toEqual([...STAFF_AREAS]);
  });

  it("managers manage only the services they were given; admins manage everything", () => {
    expect(canStaff({ role: "ADMIN", staffAreas: [] }, "money")).toBe(true);
    const laundry = { role: "MANAGER", staffAreas: ["laundry", "food"] };
    expect(canStaff(laundry, "laundry")).toBe(true);
    expect(canStaff(laundry, "food")).toBe(true);
    expect(canStaff(laundry, "bookings")).toBe(false);
    expect(canStaff(laundry, "money")).toBe(false);
    expect(staffAreasOf(laundry)).toEqual(["food", "laundry"]);
    expect(isAdmin(laundry)).toBe(true);
  });

  it("a manager with no services sees only the overview", () => {
    expect(staffAreasOf({ role: "MANAGER", staffAreas: [] })).toEqual([]);
  });

  it("customers and hosts never manage anything, whatever is stored", () => {
    expect(canStaff({ role: "USER", staffAreas: ["money"] }, "money")).toBe(false);
    expect(canStaff(null, "money")).toBe(false);
  });

  it("staff built inside the server without areas count as full staff", () => {
    expect(canStaff({ role: "MANAGER" }, "money")).toBe(true);
  });
});
