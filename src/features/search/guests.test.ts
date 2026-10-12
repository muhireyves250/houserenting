import { describe, expect, it } from "vitest";
import { canStep, stepGuests, totalGuests } from "./guests";

const empty = { adults: 0, children: 0, pets: 0 };

describe("stepGuests", () => {
  it("adds and removes guests without going negative", () => {
    expect(stepGuests(empty, "adults", 1)).toEqual({ adults: 1, children: 0, pets: 0 });
    expect(stepGuests(empty, "adults", -1)).toEqual(empty);
  });

  it("adds an adult automatically when a child or pet is added first", () => {
    expect(stepGuests(empty, "children", 1)).toEqual({ adults: 1, children: 1, pets: 0 });
    expect(stepGuests(empty, "pets", 1)).toEqual({ adults: 1, children: 0, pets: 1 });
  });

  it("keeps at least one adult while children or pets are present", () => {
    expect(stepGuests({ adults: 1, children: 2, pets: 0 }, "adults", -1)).toEqual({ adults: 1, children: 2, pets: 0 });
  });

  it("caps people at 16 and pets at 5", () => {
    expect(stepGuests({ adults: 10, children: 6, pets: 0 }, "adults", 1)).toEqual({ adults: 10, children: 6, pets: 0 });
    expect(stepGuests({ adults: 1, children: 0, pets: 5 }, "pets", 1)).toEqual({ adults: 1, children: 0, pets: 5 });
  });
});

describe("canStep", () => {
  it("reports whether a button would change anything", () => {
    expect(canStep(empty, "adults", -1)).toBe(false);
    expect(canStep(empty, "adults", 1)).toBe(true);
    expect(canStep({ adults: 1, children: 1, pets: 0 }, "adults", -1)).toBe(false);
  });
});

describe("totalGuests", () => {
  it("counts adults and children, not pets", () => {
    expect(totalGuests({ adults: 2, children: 1, pets: 3 })).toBe(3);
  });
});
