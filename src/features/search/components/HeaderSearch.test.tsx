import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSearchState, useSearchState } from "@/features/search/search-store";
import { renderWithIntl } from "@/test/render";
import { HeaderSearch } from "./HeaderSearch";
import { HERO_SEARCH_ID } from "./SearchBar";

let currentPath = "/";
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => currentPath }));

let report: (visible: boolean) => void = () => {};

beforeEach(() => {
  currentPath = "/";
  resetSearchState();
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} })));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ locations: [] }))));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        report = (visible) => callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
      observe() {}
      disconnect() {}
    },
  );
  const hero = document.createElement("div");
  hero.id = HERO_SEARCH_ID;
  document.body.appendChild(hero);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.getElementById(HERO_SEARCH_ID)?.remove();
});

function Wrapper() {
  // Mirrors a value the user typed in the hero search.
  const [, set] = useSearchState();
  return <button onClick={() => set({ location: "Musanze" })}>type in hero</button>;
}

describe("HeaderSearch", () => {
  it("shows nothing while the hero search is on screen", () => {
    renderWithIntl(<HeaderSearch />);
    act(() => report(true));
    expect(screen.queryByRole("group", { name: "Search" })).not.toBeInTheDocument();
  });

  it("shows a compact pill once the hero search scrolls away, reflecting entered values", async () => {
    renderWithIntl(
      <>
        <Wrapper />
        <HeaderSearch />
      </>,
    );
    act(() => report(false));
    const pill = screen.getByRole("group", { name: "Search" });
    expect(pill).toHaveTextContent("Anywhere");
    expect(pill).toHaveTextContent("Any dates");
    expect(pill).toHaveTextContent("Add guests");
    await userEvent.click(screen.getByRole("button", { name: "type in hero" }));
    expect(pill).toHaveTextContent("Musanze");
  });

  it("expands into the full search with the clicked panel open, and collapses on Escape", async () => {
    renderWithIntl(<HeaderSearch />);
    act(() => report(false));
    await userEvent.click(screen.getByRole("button", { name: "Any dates" }));
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Search" })).toBeInTheDocument();
  });

  it("moves focus into the opened panel and back to the pill part on Escape", async () => {
    renderWithIntl(<HeaderSearch />);
    act(() => report(false));
    const trigger = screen.getByRole("button", { name: "Any dates" });
    await userEvent.click(trigger);
    expect(screen.getByTestId("search-panel")).toContainElement(document.activeElement as HTMLElement);
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Any dates" })).toHaveFocus();
  });

  it("follows client-side navigation: starts watching a hero that appears later", () => {
    document.getElementById(HERO_SEARCH_ID)?.remove();
    currentPath = "/search";
    const view = renderWithIntl(<HeaderSearch />);
    expect(screen.queryByRole("group", { name: "Search" })).not.toBeInTheDocument();

    const hero = document.createElement("div");
    hero.id = HERO_SEARCH_ID;
    document.body.appendChild(hero);
    currentPath = "/";
    view.rerender(<HeaderSearch />);
    act(() => report(false));
    expect(screen.getByRole("group", { name: "Search" })).toBeInTheDocument();
  });

  it("hides the pill on pages without a hero search, even if it was showing before", () => {
    const view = renderWithIntl(<HeaderSearch />);
    act(() => report(false));
    expect(screen.getByRole("group", { name: "Search" })).toBeInTheDocument();
    document.getElementById(HERO_SEARCH_ID)?.remove();
    currentPath = "/listings/abc";
    view.rerender(<HeaderSearch />);
    expect(screen.queryByRole("group", { name: "Search" })).not.toBeInTheDocument();
  });
});
