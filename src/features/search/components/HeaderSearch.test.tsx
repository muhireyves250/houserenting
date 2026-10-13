import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSearchState, useSearchState } from "@/features/search/search-store";
import { renderWithIntl } from "@/test/render";
import { HeaderSearch } from "./HeaderSearch";
import { HERO_SEARCH_ID, SearchBar } from "./SearchBar";

const animateScrollTo = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/lib/animate-scroll", () => ({ animateScrollTo }));

let currentPath = "/";
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => currentPath }));

let report: (visible: boolean) => void = () => {};
let placeholderHero: HTMLElement | null = null;

beforeEach(() => {
  currentPath = "/";
  resetSearchState();
  // Desktop viewport, motion allowed.
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: !query.includes("reduce"), addEventListener: () => {}, removeEventListener: () => {} })),
  );
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
  placeholderHero = document.createElement("div");
  placeholderHero.id = HERO_SEARCH_ID;
  document.body.appendChild(placeholderHero);
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Only remove the placeholder this file created; React unmounts its own elements.
  placeholderHero?.remove();
  placeholderHero = null;
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

  it("smoothly scrolls back to the hero and opens the clicked panel there", async () => {
    document.getElementById(HERO_SEARCH_ID)?.remove();
    renderWithIntl(
      <>
        <SearchBar id={HERO_SEARCH_ID} today="2026-10-12" />
        <HeaderSearch />
      </>,
    );
    act(() => report(false));
    await userEvent.click(screen.getByRole("button", { name: "Any dates" }));
    // Eased scroll to the top first, then the hero's own calendar opens; no second search bar.
    expect(animateScrollTo).toHaveBeenCalledWith(0);
    expect(await screen.findByRole("button", { name: "Next month" })).toBeInTheDocument();
    expect(screen.getAllByRole("search")).toHaveLength(1);
    expect(screen.getByTestId("search-panel")).toContainElement(document.activeElement as HTMLElement);
  });

  it("opening Where from the header focuses the hero's Where field", async () => {
    document.getElementById(HERO_SEARCH_ID)?.remove();
    renderWithIntl(
      <>
        <SearchBar id={HERO_SEARCH_ID} today="2026-10-12" />
        <HeaderSearch />
      </>,
    );
    act(() => report(false));
    await userEvent.click(screen.getByRole("button", { name: "Anywhere" }));
    await vi.waitFor(() => expect(screen.getByRole("combobox", { name: "Where" })).toHaveFocus());
  });

  it("is always in the header on pages without a hero search", () => {
    document.getElementById(HERO_SEARCH_ID)?.remove();
    currentPath = "/listings/abc";
    renderWithIntl(<HeaderSearch />);
    expect(screen.getByRole("group", { name: "Search" })).toHaveTextContent("Anywhere");
  });

  it("there, opens the full search under the header on the clicked part, and closes with Escape", async () => {
    document.getElementById(HERO_SEARCH_ID)?.remove();
    currentPath = "/search";
    renderWithIntl(<HeaderSearch today="2026-10-12" />);
    await userEvent.click(screen.getByRole("button", { name: "Any dates" }));
    expect(animateScrollTo).not.toHaveBeenCalled();
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Next month" })).toBeInTheDocument();
    // The whole page behind is blurred by one backdrop (not the bar's own blur).
    expect(screen.getByTestId("search-backdrop")).toBeInTheDocument();
    expect(screen.queryByTestId("page-blur")).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    // Plays its exit animation, then unmounts.
    expect(screen.getByTestId("search-backdrop")).toHaveAttribute("data-closing", "true");
    await vi.waitFor(() => expect(screen.queryByRole("search")).not.toBeInTheDocument());
    expect(screen.queryByTestId("search-backdrop")).not.toBeInTheDocument();
  });

  it("follows client-side navigation into a page with a hero: hidden while the hero shows", () => {
    document.getElementById(HERO_SEARCH_ID)?.remove();
    currentPath = "/search";
    const view = renderWithIntl(<HeaderSearch />);
    expect(screen.getByRole("group", { name: "Search" })).toBeInTheDocument();

    const hero = document.createElement("div");
    hero.id = HERO_SEARCH_ID;
    document.body.appendChild(hero);
    currentPath = "/";
    view.rerender(<HeaderSearch />);
    act(() => report(true));
    expect(screen.queryByRole("group", { name: "Search" })).not.toBeInTheDocument();
    act(() => report(false));
    expect(screen.getByRole("group", { name: "Search" })).toBeInTheDocument();
    hero.remove();
  });
});
