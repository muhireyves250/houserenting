import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
const { can } = await import("./access");

describe("place permissions", () => {
  it("owners and staff do everything; managers no money, documents or team; receptionists the front desk only", () => {
    expect(can("owner", "team")).toBe(true);
    expect(can("staff", "money")).toBe(true);
    expect(can("manager", "edit")).toBe(true);
    expect(can("manager", "money")).toBe(false);
    expect(can("manager", "documents")).toBe(false);
    expect(can("manager", "team")).toBe(false);
    expect(can("receptionist", "checkIn")).toBe(true);
    expect(can("receptionist", "edit")).toBe(false);
    expect(can("receptionist", "requests")).toBe(false);
    expect(can(null, "bookings")).toBe(false);
  });
});
