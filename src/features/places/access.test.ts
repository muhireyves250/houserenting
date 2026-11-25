import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
const { can } = await import("./access");

describe("place permissions", () => {
  it("staff do everything; owners add places, block dates, upload papers and run their front desk; so do the place's manager and receptionist", () => {
    expect(can("owner", "team")).toBe(false);
    expect(can("owner", "blocks")).toBe(true);
    expect(can("owner", "requests")).toBe(false);
    // The owner runs the front desk of their own places too.
    expect(can("owner", "checkIn")).toBe(true);
    expect(can("staff", "team")).toBe(true);
    expect(can("staff", "money")).toBe(true);
    expect(can("manager", "edit")).toBe(true);
    expect(can("manager", "money")).toBe(false);
    expect(can("manager", "documents")).toBe(false);
    expect(can("manager", "team")).toBe(false);
    expect(can("receptionist", "checkIn")).toBe(true);
    expect(can("receptionist", "guestId")).toBe(true);
    expect(can("receptionist", "money")).toBe(false);
    expect(can("owner", "bookings")).toBe(true);
    expect(can("manager", "bookings")).toBe(true);
    expect(can("manager", "guestId")).toBe(true);
    expect(can("staff", "bookings")).toBe(true);
    expect(can("receptionist", "edit")).toBe(false);
    expect(can("receptionist", "requests")).toBe(false);
    expect(can(null, "bookings")).toBe(false);
  });
});
