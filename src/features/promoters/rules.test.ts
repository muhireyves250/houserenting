import { describe, expect, it } from "vitest";
import { safeTarget, isPromoterCode } from "./cookie";
import { promoterRewardFor } from "./rules";

describe("promoter rewards", () => {
  it("uses the fixed amount first, else a share of the stay price, else nothing", () => {
    expect(promoterRewardFor({ promoterRewardFixed: 5000, promoterRewardBps: 500 }, 100_000)).toBe(5000);
    expect(promoterRewardFor({ promoterRewardFixed: null, promoterRewardBps: 250 }, 100_000)).toBe(2500);
    expect(promoterRewardFor({ promoterRewardFixed: null, promoterRewardBps: null }, 100_000)).toBe(0);
  });
});

describe("promoter links", () => {
  it("accepts only real codes and on-site targets", () => {
    expect(isPromoterCode("P-7K2M9Q")).toBe(true);
    expect(isPromoterCode("R-7K2M9Q")).toBe(false);
    expect(safeTarget("/listings/abc")).toBe("/listings/abc");
    expect(safeTarget("//evil.example")).toBe("/");
    expect(safeTarget("https://evil.example")).toBe("/");
    expect(safeTarget(null)).toBe("/");
  });
});
