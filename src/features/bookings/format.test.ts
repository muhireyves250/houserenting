import { describe, expect, it } from "vitest";
import { directionsUrl, formatKigaliTime, formatStayDates } from "./format";

describe("booking formatting", () => {
  it("writes a stay as one date range", () => {
    expect(formatStayDates("en", "2026-10-20", "2026-10-23")).toBe("Oct 20\u2009–\u200923, 2026");
  });

  it("shows times in Rwanda's time zone", () => {
    expect(formatKigaliTime("en-GB", new Date("2026-10-14T08:30:00Z"))).toBe("10:30");
  });

  it("links directions to the place's coordinates", () => {
    expect(directionsUrl(-1.95, 30.06)).toBe("https://www.google.com/maps/dir/?api=1&destination=-1.95,30.06");
  });
});
