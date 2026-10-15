import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
const { toCsv } = await import("./queries");

describe("toCsv", () => {
  it("quotes every cell, doubles quotes, and neutralises spreadsheet formulas", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"'], ["=SUM(A1)", null]])).toBe('"a","b"\r\n"x,y","say ""hi"""\r\n"\'=SUM(A1)",""\r\n');
  });
});
