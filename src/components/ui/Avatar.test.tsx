import { describe, expect, it } from "vitest";
import { initials } from "./Avatar";

describe("initials", () => {
  it("uses first and last name initials", () => {
    expect(initials("Alona Kotilevska")).toBe("AK");
    expect(initials("Jean Paul Habimana")).toBe("JH");
  });
  it("handles single names, extra spaces and accents", () => {
    expect(initials("  émile  ")).toBe("É");
  });
  it("falls back for empty names", () => {
    expect(initials("   ")).toBe("?");
  });
});
