import { describe, expect, it } from "vitest";
import { maskPhone, parseMobileMoney } from "./mobile-money";

describe("parseMobileMoney", () => {
  it("accepts Rwandan MTN (078/079) and Airtel (072/073) numbers in common formats", () => {
    expect(parseMobileMoney("mtn", "078 812 3456")).toEqual({ ok: true, number: "+250788123456" });
    expect(parseMobileMoney("mtn", "+250 79 123 4567")).toEqual({ ok: true, number: "+250791234567" });
    expect(parseMobileMoney("airtel", "0731234567")).toEqual({ ok: true, number: "+250731234567" });
    expect(parseMobileMoney("airtel", "250721234567")).toEqual({ ok: true, number: "+250721234567" });
  });

  it("rejects numbers from the other network or of the wrong length", () => {
    expect(parseMobileMoney("mtn", "0731234567")).toEqual({ ok: false, error: "network" });
    expect(parseMobileMoney("airtel", "0781234567")).toEqual({ ok: false, error: "network" });
    expect(parseMobileMoney("mtn", "07812345")).toEqual({ ok: false, error: "invalid" });
    expect(parseMobileMoney("mtn", "hello")).toEqual({ ok: false, error: "invalid" });
  });
});

describe("maskPhone", () => {
  it("shows the start and end only", () => {
    expect(maskPhone("+250788123456")).toBe("078 ••• 3456");
  });
});
