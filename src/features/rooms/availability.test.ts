import { describe, expect, it } from "vitest";
import { roomStatusOn } from "./availability";

const taken = [
  { checkIn: "2026-11-10", checkOut: "2026-11-12", roomId: "a" },
  { checkIn: "2026-11-12", checkOut: "2026-11-13", roomId: "a" },
  { checkIn: "2026-11-20", checkOut: "2026-11-21", roomId: null },
];

describe("roomStatusOn", () => {
  it("a room is free when nothing of its own or of the whole place covers the day", () => {
    expect(roomStatusOn(taken, "b", "2026-11-10")).toEqual({ free: true });
    expect(roomStatusOn(taken, "a", "2026-11-13")).toEqual({ free: true });
  });

  it("a booked room says when it is free again, following back-to-back bookings", () => {
    expect(roomStatusOn(taken, "a", "2026-11-11")).toEqual({ free: false, freeFrom: "2026-11-13" });
  });

  it("a whole-place booking takes every room", () => {
    expect(roomStatusOn(taken, "b", "2026-11-20")).toEqual({ free: false, freeFrom: "2026-11-21" });
  });
});
