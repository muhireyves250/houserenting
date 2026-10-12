import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeroVideo } from "./HeroVideo";

function stubMedia({ desktop, reduceMotion }: { desktop: boolean; reduceMotion: boolean }) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("reduce") ? reduceMotion : desktop,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

describe("HeroVideo", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("plays a muted, looping, decorative video on desktop", () => {
    stubMedia({ desktop: true, reduceMotion: false });
    const { container } = render(<HeroVideo src="/hero.mp4" />);
    const video = container.querySelector("video")!;
    expect(video).not.toBeNull();
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(video).toHaveAttribute("src", "/hero.mp4");
  });

  it("skips the video on phones to save mobile data", () => {
    stubMedia({ desktop: false, reduceMotion: false });
    const { container } = render(<HeroVideo src="/hero.mp4" />);
    expect(container.querySelector("video")).toBeNull();
  });

  it("skips the video for people who prefer reduced motion", () => {
    stubMedia({ desktop: true, reduceMotion: true });
    const { container } = render(<HeroVideo src="/hero.mp4" />);
    expect(container.querySelector("video")).toBeNull();
  });

  it("skips the video when the browser asks to save data", () => {
    stubMedia({ desktop: true, reduceMotion: false });
    vi.stubGlobal("navigator", { ...navigator, connection: { saveData: true } });
    const { container } = render(<HeroVideo src="/hero.mp4" />);
    expect(container.querySelector("video")).toBeNull();
  });
});
