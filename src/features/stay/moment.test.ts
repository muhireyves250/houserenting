import { describe, expect, it } from "vitest";
import { stayMoment } from "./moment";

const stay = { status: "CONFIRMED", checkIn: "2026-11-10", checkOut: "2026-11-13" };

describe("stayMoment", () => {
  it("follows the stay from booking to departure", () => {
    expect(stayMoment({ ...stay, status: "PENDING_PAYMENT" }, "2026-11-01")).toEqual({ kind: "unpaid" });
    expect(stayMoment(stay, "2026-11-07")).toEqual({ kind: "upcoming", days: 3 });
    expect(stayMoment(stay, "2026-11-10")).toEqual({ kind: "arrival" });
    expect(stayMoment({ ...stay, status: "CHECKED_IN" }, "2026-11-10")).toEqual({ kind: "during", day: 1, total: 3 });
    expect(stayMoment({ ...stay, status: "CHECKED_IN" }, "2026-11-11")).toEqual({ kind: "during", day: 2, total: 3 });
    expect(stayMoment({ ...stay, status: "CHECKED_IN" }, "2026-11-13")).toEqual({ kind: "departure" });
  });
});
