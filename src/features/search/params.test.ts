import { describe, expect, it } from "vitest";
import { buildSearchQuery, filterParams, formatBbox, parseSearchParams } from "./params";

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

describe("type of place and price filters", () => {
  it("parses a comma list of known types and a price range, in both modes", () => {
    expect(parseSearchParams({ type: "LODGE,APARTMENT", minPrice: "20000", maxPrice: "150000" })).toEqual({
      mode: "short",
      types: ["LODGE", "APARTMENT"],
      minPrice: 20000,
      maxPrice: 150000,
    });
    expect(parseSearchParams({ mode: "long", type: "ROOM", maxPrice: "500000" })).toEqual({ mode: "long", types: ["ROOM"], maxPrice: 500000 });
  });

  it("drops unknown types, duplicates, garbage prices and an inverted range's max", () => {
    expect(parseSearchParams({ type: "CASTLE,ROOM,ROOM" })).toEqual({ mode: "short", types: ["ROOM"] });
    expect(parseSearchParams({ type: "CASTLE", minPrice: "abc", maxPrice: "-5" })).toEqual({ mode: "short" });
    expect(parseSearchParams({ minPrice: "90000", maxPrice: "10000" })).toEqual({ mode: "short", minPrice: 90000 });
  });

  it("serialises filters back to URL params", () => {
    expect(filterParams({ types: ["LODGE", "ROOM"], minPrice: 1000 })).toEqual({ type: "LODGE,ROOM", minPrice: "1000" });
    expect(filterParams({ types: [] })).toEqual({});
  });
});

describe("map area (bbox)", () => {
  it("parses south,west,north,east in both modes", () => {
    expect(parseSearchParams({ bbox: "-2.1,29.3,-1.5,30.1" })).toEqual({ mode: "short", bbox: [-2.1, 29.3, -1.5, 30.1] });
    expect(parseSearchParams({ mode: "long", bbox: "-2.1,29.3,-1.5,30.1" })).toMatchObject({ bbox: [-2.1, 29.3, -1.5, 30.1] });
  });

  it("drops malformed, out-of-range or inverted boxes", () => {
    expect(parseSearchParams({ bbox: "a,b,c,d" })).toEqual({ mode: "short" });
    expect(parseSearchParams({ bbox: "-2,29,-1" })).toEqual({ mode: "short" });
    expect(parseSearchParams({ bbox: "-95,29,-1,30" })).toEqual({ mode: "short" });
    expect(parseSearchParams({ bbox: "-1,29,-2,30" })).toEqual({ mode: "short" });
  });

  it("formats a box for the URL, rounded to 4 decimals", () => {
    expect(formatBbox([-2.123456, 29.300001, -1.5, 30.1])).toBe("-2.1235,29.3,-1.5,30.1");
  });
});
