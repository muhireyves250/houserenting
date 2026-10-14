import { describe, expect, it } from "vitest";
import { canTransition, isHoldActive, stayPhase } from "./status";

const now = new Date("2026-10-14T10:00:00Z");

describe("booking state machine", () => {
  it("allows only the documented transitions", () => {
    expect(canTransition("PENDING_PAYMENT", "CONFIRMED")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "EXPIRED")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "CHECKED_IN")).toBe(true);
    expect(canTransition("CHECKED_IN", "COMPLETED")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "CHECKED_IN")).toBe(false);
    expect(canTransition("EXPIRED", "CONFIRMED")).toBe(false);
    expect(canTransition("CANCELLED", "PENDING_PAYMENT")).toBe(false);
    expect(canTransition("COMPLETED", "CHECKED_IN")).toBe(false);
  });

  it("treats a pending hold past its expiry as released", () => {
    expect(isHoldActive({ status: "PENDING_PAYMENT", holdExpiresAt: new Date("2026-10-14T10:05:00Z") }, now)).toBe(true);
    expect(isHoldActive({ status: "PENDING_PAYMENT", holdExpiresAt: new Date("2026-10-14T09:59:00Z") }, now)).toBe(false);
    expect(isHoldActive({ status: "CONFIRMED", holdExpiresAt: null }, now)).toBe(false);
  });
});

describe("stayPhase", () => {
  const stay = (status: Parameters<typeof stayPhase>[0]["status"], checkIn: string, checkOut: string) => ({
    status,
    checkIn,
    checkOut,
    holdExpiresAt: new Date("2026-10-14T10:30:00Z"),
  });

  it("puts paid stays happening today in current", () => {
    expect(stayPhase(stay("CONFIRMED", "2026-10-13", "2026-10-15"), "2026-10-14", now)).toBe("current");
    expect(stayPhase(stay("CHECKED_IN", "2026-10-10", "2026-10-14"), "2026-10-14", now)).toBe("current");
  });

  it("puts future stays and live holds in upcoming", () => {
    expect(stayPhase(stay("CONFIRMED", "2026-10-20", "2026-10-22"), "2026-10-14", now)).toBe("upcoming");
    expect(stayPhase(stay("PENDING_PAYMENT", "2026-10-20", "2026-10-22"), "2026-10-14", now)).toBe("upcoming");
  });

  it("puts finished, cancelled and lapsed bookings in past", () => {
    expect(stayPhase(stay("CONFIRMED", "2026-10-01", "2026-10-03"), "2026-10-14", now)).toBe("past");
    expect(stayPhase(stay("COMPLETED", "2026-10-13", "2026-10-15"), "2026-10-14", now)).toBe("past");
    expect(stayPhase(stay("CANCELLED", "2026-10-20", "2026-10-22"), "2026-10-14", now)).toBe("past");
    expect(stayPhase({ ...stay("PENDING_PAYMENT", "2026-10-20", "2026-10-22"), holdExpiresAt: new Date("2026-10-14T09:00:00Z") }, "2026-10-14", now)).toBe("past");
  });
});
