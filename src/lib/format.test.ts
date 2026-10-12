import { describe, expect, it } from "vitest";
import { formatRWF } from "./format";

describe("formatRWF", () => {
  it("formats whole francs with English grouping", () => {
    expect(formatRWF(45000)).toBe("RWF 45,000");
    expect(formatRWF(0)).toBe("RWF 0");
  });

  it("uses French grouping for fr", () => {
    expect(formatRWF(1250000, "fr")).toMatch(/^RWF 1\s250\s000$/);
  });

  it("rejects fractional or non-finite amounts", () => {
    expect(() => formatRWF(10.5)).toThrow(RangeError);
    expect(() => formatRWF(Number.NaN)).toThrow(RangeError);
  });
});
