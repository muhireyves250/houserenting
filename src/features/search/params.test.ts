import { describe, expect, it } from "vitest";
import { buildSearchQuery, parseSearchParams } from "./params";

describe("buildSearchQuery", () => {
  it("keeps only filled short-term fields", () => {
    expect(buildSearchQuery("short", { location: " Kigali ", checkIn: "2026-11-01", checkOut: "", guests: "2" })).toEqual({
      mode: "short",
      location: "Kigali",
      checkIn: "2026-11-01",
      guests: "2",
    });
  });

  it("drops dates and guests for long-term searches", () => {
    expect(buildSearchQuery("long", { location: "Musanze", checkIn: "2026-11-01", guests: "3" })).toEqual({ mode: "long", location: "Musanze" });
  });
});

describe("parseSearchParams", () => {
  it("parses a valid short-term query", () => {
    expect(parseSearchParams({ mode: "short", location: "Kigali", checkIn: "2026-11-01", checkOut: "2026-11-04", guests: "2" })).toEqual({
      mode: "short",
      location: "Kigali",
      checkIn: "2026-11-01",
      checkOut: "2026-11-04",
      guests: 2,
    });
  });

  it("sanitizes garbage instead of throwing", () => {
    expect(
      parseSearchParams({ mode: "xyz", location: ["a", "b"], checkIn: "2026-02-31", checkOut: "tomorrow", guests: "-4" }),
    ).toEqual({ mode: "short", location: "a" });
  });

  it("drops a check-out that is not after check-in", () => {
    expect(parseSearchParams({ checkIn: "2026-11-05", checkOut: "2026-11-05" })).toEqual({ mode: "short", checkIn: "2026-11-05" });
  });

  it("caps guests and location length", () => {
    const parsed = parseSearchParams({ guests: "500", location: "x".repeat(300) });
    expect(parsed.guests).toBeUndefined();
    expect(parsed.location).toHaveLength(100);
  });

  it("ignores dates and guests in long-term mode", () => {
    expect(parseSearchParams({ mode: "long", checkIn: "2026-11-01", guests: "2" })).toEqual({ mode: "long" });
  });
});
