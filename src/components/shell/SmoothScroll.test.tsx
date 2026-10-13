import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SmoothScroll } from "./SmoothScroll";

const { instances, Lenis } = vi.hoisted(() => {
  const instances: { stop: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; options: unknown }[] = [];
  const Lenis = vi.fn(function (this: (typeof instances)[number], options: unknown) {
    this.stop = vi.fn();
    this.start = vi.fn();
    this.destroy = vi.fn();
    this.options = options;
    instances.push(this);
  });
  return { instances, Lenis };
});
vi.mock("lenis", () => ({ default: Lenis }));

function media(matches: Record<string, boolean>) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: matches[query] ?? false }));
}

beforeEach(() => {
  instances.length = 0;
  Lenis.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

describe("SmoothScroll", () => {
  it("eases wheel scrolling on mouse/trackpad devices", () => {
    media({});
    render(<SmoothScroll />);
    expect(Lenis).toHaveBeenCalledTimes(1);
  });

  it("stays off for reduced motion and touch screens", () => {
    media({ "(prefers-reduced-motion: reduce)": true });
    render(<SmoothScroll />);
    media({ "(pointer: coarse)": true });
    render(<SmoothScroll />);
    expect(Lenis).not.toHaveBeenCalled();
  });

  it("pauses while a dialog locks the page, and lets maps and dialogs scroll themselves", async () => {
    media({});
    render(<SmoothScroll />);
    const lenis = instances[0]!;
    document.body.style.overflow = "hidden";
    await new Promise((r) => setTimeout(r, 0));
    expect(lenis.stop).toHaveBeenCalled();
    document.body.style.overflow = "";
    await new Promise((r) => setTimeout(r, 0));
    expect(lenis.start).toHaveBeenCalled();

    const { prevent } = lenis.options as { prevent: (node: HTMLElement) => boolean };
    const map = document.createElement("div");
    map.className = "maplibregl-map";
    const inner = document.createElement("canvas");
    map.append(inner);
    expect(prevent(inner)).toBe(true);
    expect(prevent(document.createElement("p"))).toBe(false);
  });
});
