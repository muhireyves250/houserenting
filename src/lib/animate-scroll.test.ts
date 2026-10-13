import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { animateScrollTo, easeInOutCubic, scrollDuration, slideDuration, slideScrollLeft } from "./animate-scroll";

describe("easeInOutCubic", () => {
  it("starts and ends gently and is symmetric", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(0.1)).toBeLessThan(0.1);
    expect(easeInOutCubic(0.9)).toBeGreaterThan(0.9);
  });
});

describe("scrollDuration", () => {
  it("grows with distance within a slow, relaxed 900–1600ms", () => {
    expect(scrollDuration(50)).toBe(900);
    expect(scrollDuration(1200)).toBeGreaterThan(scrollDuration(600));
    expect(scrollDuration(100_000)).toBe(1600);
  });
});

describe("animateScrollTo", () => {
  let now = 0;
  let y = 1000;
  beforeEach(() => {
    now = 0;
    y = 1000;
    vi.stubGlobal("performance", { now: () => now });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb((now += 16)), 0) as unknown as number);
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    Object.defineProperty(window, "scrollY", { configurable: true, get: () => y });
    vi.stubGlobal("scrollTo", (_x: number, top: number) => {
      y = top;
    });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("eases the page to the target and resolves when done", async () => {
    const positions: number[] = [];
    const watch = setInterval(() => positions.push(y), 0);
    await animateScrollTo(0);
    clearInterval(watch);
    expect(y).toBe(0);
    // Moves through intermediate positions rather than jumping.
    expect(positions.some((p) => p > 0 && p < 1000)).toBe(true);
  });

  it("stops and hands control back when the user scrolls", async () => {
    const done = animateScrollTo(0);
    window.dispatchEvent(new Event("wheel"));
    await done;
    expect(y).toBeGreaterThan(0);
  });

  it("jumps instantly when the user prefers reduced motion", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    await animateScrollTo(0);
    expect(y).toBe(0);
  });
});

describe("slideScrollLeft", () => {
  function track(scrollLeft: number) {
    const el = document.createElement("div");
    Object.defineProperty(el, "clientWidth", { value: 600 });
    Object.defineProperty(el, "scrollWidth", { value: 1800 });
    let left = scrollLeft;
    Object.defineProperty(el, "scrollLeft", { get: () => left, set: (v: number) => (left = v) });
    return el;
  }

  it("jumps straight there, clamped to the end, when the user prefers reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const el = track(1000);
    slideScrollLeft(el, 600);
    expect(el.scrollLeft).toBe(1200);
    vi.unstubAllGlobals();
  });

  it("eases there over a few frames and restores scroll snapping", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
    const began = performance.now();
    const el = track(0);
    el.style.scrollSnapType = "x mandatory";
    slideScrollLeft(el, 600);
    expect(el.style.scrollSnapType).toBe("none");
    frames.shift()!(began + slideDuration(600) / 2);
    expect(el.scrollLeft).toBeGreaterThan(0);
    expect(el.scrollLeft).toBeLessThan(600);
    frames.shift()!(began + 10_000);
    expect(el.scrollLeft).toBe(600);
    expect(el.style.scrollSnapType).toBe("x mandatory");
    vi.unstubAllGlobals();
  });
});
