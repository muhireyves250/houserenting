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

describe("pets and date flexibility", () => {
  it("parses pets (1–5) and flex (1–3 days) for short-term searches", () => {
    expect(parseSearchParams({ pets: "2", flex: "3", checkIn: "2026-11-01" })).toEqual({ mode: "short", pets: 2, flex: 3, checkIn: "2026-11-01" });
  });

  it("drops out-of-range or garbage values", () => {
    expect(parseSearchParams({ pets: "9", flex: "7" })).toEqual({ mode: "short" });
    expect(parseSearchParams({ pets: "-1", flex: "x" })).toEqual({ mode: "short" });
  });

  it("builds pets and flex into the query, and drops them for long-term", () => {
    expect(buildSearchQuery("short", { location: "Kigali", guests: 3, pets: 1, flex: 2 })).toEqual({
      mode: "short",
      location: "Kigali",
      guests: "3",
      pets: "1",
      flex: "2",
    });
    expect(buildSearchQuery("long", { location: "Kigali", pets: 1, flex: 2 })).toEqual({ mode: "long", location: "Kigali" });
  });

  it("omits zero counts", () => {
    expect(buildSearchQuery("short", { guests: 0, pets: 0, flex: 0 })).toEqual({ mode: "short" });
  });
});
