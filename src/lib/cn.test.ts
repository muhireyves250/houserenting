import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", false && "b", undefined, "c")).toBe("a c");
  });

  it("lets later Tailwind utilities win over earlier conflicting ones", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });
});
