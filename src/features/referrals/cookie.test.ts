import { describe, expect, it } from "vitest";
import { referralFromUrl } from "./cookie";

describe("referralFromUrl", () => {
  it("reads a valid invite code from a link", () => {
    expect(referralFromUrl("https://example.com/?ref=r-7k2m9q")).toBe("R-7K2M9Q");
    expect(referralFromUrl("https://example.com/en/search?ref=R-7K2M9Q&mode=short")).toBe("R-7K2M9Q");
  });

  it("ignores anything else", () => {
    expect(referralFromUrl("https://example.com/?ref=<script>")).toBeNull();
    expect(referralFromUrl("https://example.com/?ref=R-0000OO")).toBeNull();
    expect(referralFromUrl("https://example.com/")).toBeNull();
  });
});
