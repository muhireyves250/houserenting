import { describe, expect, it } from "vitest";
import { nextScrollState } from "./use-scroll-direction";

describe("nextScrollState", () => {
  const start = { hidden: false, scrolled: false, lastY: 0 };

  it("hides after scrolling down past the threshold and shows again on scroll up", () => {
    const down = nextScrollState(start, 300, 0);
    expect(down).toMatchObject({ hidden: true, scrolled: true });
    expect(nextScrollState(down, 260, 1000)).toMatchObject({ hidden: false, scrolled: true });
  });

  it("ignores small jitters and always shows near the top", () => {
    const down = nextScrollState(start, 300, 0);
    expect(nextScrollState(down, 296, 1000).hidden).toBe(true);
    expect(nextScrollState(down, 20, 1000)).toMatchObject({ hidden: false });
    expect(nextScrollState(start, 4, 1000).scrolled).toBe(false);
  });

  it("ignores the scroll shift caused by its own hide/show for a moment", () => {
    const down = nextScrollState(start, 300, 1000);
    expect(down.hidden).toBe(true);
    // The bar collapses and the browser moves the page up 46px: not a real scroll up.
    expect(nextScrollState(down, 254, 1100).hidden).toBe(true);
    // Later, a real scroll up shows it again.
    expect(nextScrollState({ ...down, lastY: 254 }, 200, 2000).hidden).toBe(false);
  });
});
