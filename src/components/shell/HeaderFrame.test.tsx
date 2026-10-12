import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HeaderFrame } from "./HeaderFrame";

let currentPath = "/";
vi.mock("@/i18n/navigation", () => ({ usePathname: () => currentPath }));

function setScroll(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  window.dispatchEvent(new Event("scroll"));
}

describe("HeaderFrame", () => {
  afterEach(() => {
    currentPath = "/";
    setScroll(0);
  });

  it("is transparent over the home hero at the top of the page", () => {
    render(<HeaderFrame>content</HeaderFrame>);
    expect(screen.getByRole("banner")).toHaveAttribute("data-overlay", "true");
  });

  it("turns solid once the page scrolls, and back at the top", () => {
    render(<HeaderFrame>content</HeaderFrame>);
    act(() => setScroll(120));
    expect(screen.getByRole("banner")).toHaveAttribute("data-overlay", "false");
    act(() => setScroll(0));
    expect(screen.getByRole("banner")).toHaveAttribute("data-overlay", "true");
  });

  it("is always solid on pages without the hero", () => {
    currentPath = "/search";
    render(<HeaderFrame>content</HeaderFrame>);
    expect(screen.getByRole("banner")).toHaveAttribute("data-overlay", "false");
  });
});
