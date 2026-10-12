import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSearchState } from "@/features/search/search-store";
import { renderWithIntl } from "@/test/render";
import { SearchBar } from "./SearchBar";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));

const TODAY = "2026-10-12";

function stubViewport(desktop: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: desktop, addEventListener: () => {}, removeEventListener: () => {} })),
  );
}

beforeEach(() => {
  resetSearchState();
  push.mockReset();
  stubViewport(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ locations: [{ city: "Kigali", count: 5 }, { city: "Musanze", count: 2 }] }))),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("SearchBar", () => {
  it("builds a short-term search from where, when and who", async () => {
    renderWithIntl(<SearchBar today={TODAY} />);
    await userEvent.type(screen.getByRole("combobox", { name: "Where" }), "Kigali");

    await userEvent.click(screen.getByRole("button", { name: /When/ }));
    await userEvent.click(screen.getByRole("button", { name: "Wednesday, October 14, 2026" }));
    await userEvent.click(screen.getByRole("button", { name: "Sunday, October 18, 2026" }));
    expect(screen.getByRole("button", { name: /When/ })).toHaveTextContent("Oct 14 – Oct 18");

    await userEvent.click(screen.getByRole("button", { name: /Who/ }));
    await userEvent.click(screen.getByRole("button", { name: "Add one: Adults" }));
    await userEvent.click(screen.getByRole("button", { name: "Add one: Adults" }));
    await userEvent.click(screen.getByRole("button", { name: "Add one: Pets" }));
    expect(screen.getByRole("button", { name: /Who/ })).toHaveTextContent("2 guests, 1 pet");

    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith({
      pathname: "/search",
      query: { mode: "short", location: "Kigali", checkIn: "2026-10-14", checkOut: "2026-10-18", guests: "2", pets: "1" },
    });
  });

  it("disables days before today and can move between months", async () => {
    renderWithIntl(<SearchBar today={TODAY} />);
    await userEvent.click(screen.getByRole("button", { name: /When/ }));
    expect(screen.getByRole("button", { name: "Sunday, October 11, 2026" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("December 2026")).toBeInTheDocument();
  });

  it("adds date flexibility from the chips", async () => {
    renderWithIntl(<SearchBar today={TODAY} />);
    await userEvent.click(screen.getByRole("button", { name: /When/ }));
    await userEvent.click(screen.getByRole("button", { name: "Wednesday, October 14, 2026" }));
    await userEvent.click(screen.getByRole("radio", { name: "± 2 days" }));
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith({ pathname: "/search", query: { mode: "short", checkIn: "2026-10-14", flex: "2" } });
  });

  it("shows only Where for 'From 6 months'", async () => {
    renderWithIntl(<SearchBar today={TODAY} />);
    await userEvent.click(screen.getByRole("radio", { name: "From 6 months" }));
    expect(screen.queryByRole("button", { name: /When/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Who/ })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("combobox", { name: "Where" }), "Huye");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith({ pathname: "/search", query: { mode: "long", location: "Huye" } });
  });

  it("suggests destinations from real listings and fills the field on pick", async () => {
    renderWithIntl(<SearchBar today={TODAY} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Where" }));
    expect(await screen.findByText("Suggested destinations")).toBeInTheDocument();
    const option = await screen.findByRole("option", { name: /Kigali, Rwanda/ });
    expect(option).toHaveTextContent("5 places");
    await userEvent.click(option);
    expect(screen.getByRole("combobox", { name: "Where" })).toHaveValue("Kigali");
    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("closes the open panel with Escape", async () => {
    renderWithIntl(<SearchBar today={TODAY} />);
    await userEvent.click(screen.getByRole("button", { name: /Who/ }));
    expect(screen.getByText("Ages 13 or above")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByText("Ages 13 or above")).not.toBeInTheDocument();
  });

  it("slides one shared highlight to the open segment", async () => {
    renderWithIntl(<SearchBar today={TODAY} />);
    const highlight = screen.getByTestId("segment-highlight");
    expect(highlight).toHaveAttribute("data-visible", "false");
    await userEvent.click(screen.getByRole("combobox", { name: "Where" }));
    expect(highlight).toHaveAttribute("data-visible", "true");
    expect(highlight.style.transform).toBe("translateX(calc(0% + 0px))");
    await userEvent.click(screen.getByRole("button", { name: /When/ }));
    expect(highlight.style.transform).toBe("translateX(calc(100% + 8px))");
    await userEvent.click(screen.getByRole("button", { name: /Who/ }));
    expect(highlight.style.transform).toBe("translateX(calc(200% + 16px))");
    await userEvent.keyboard("{Escape}");
    expect(highlight).toHaveAttribute("data-visible", "false");
    // Stays where it was, so the next open fades in place instead of sliding from the left.
    expect(highlight.style.transform).toBe("translateX(calc(200% + 16px))");
  });

  it("slides a bordered hover pill to the segment under the mouse", async () => {
    renderWithIntl(<SearchBar today={TODAY} />);
    const pill = screen.getByTestId("hover-pill");
    expect(pill).toHaveAttribute("data-visible", "false");
    await userEvent.hover(screen.getByRole("button", { name: /When/ }));
    expect(pill).toHaveAttribute("data-visible", "true");
    expect(pill.style.transform).toBe("translateX(calc(100% + 8px))");
    await userEvent.hover(screen.getByRole("button", { name: /Who/ }));
    expect(pill.style.transform).toBe("translateX(calc(200% + 16px))");
    await userEvent.unhover(screen.getByRole("button", { name: /Who/ }));
    expect(pill).toHaveAttribute("data-visible", "false");
  });

  it("keeps one dropdown panel that slides and resizes between segments", async () => {
    renderWithIntl(<SearchBar today={TODAY} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Where" }));
    const panel = screen.getByTestId("search-panel");
    expect(panel.style.left).toBe("0px");
    expect(panel.style.width).toBe("26rem");
    await userEvent.click(screen.getByRole("button", { name: /When/ }));
    expect(screen.getByTestId("search-panel")).toBe(panel);
    expect(panel.style.width).toBe("100%");
    await userEvent.click(screen.getByRole("button", { name: /Who/ }));
    expect(screen.getByTestId("search-panel")).toBe(panel);
    expect(panel.style.left).toBe("calc(100% - 26rem)");
    expect(panel.style.width).toBe("26rem");
  });

  it("is compact at rest and expands while hovered, focused or open", async () => {
    renderWithIntl(<SearchBar today={TODAY} />);
    const bar = screen.getByRole("search");
    expect(bar).toHaveAttribute("data-expanded", "false");
    // The button keeps its accessible name even when only the icon shows.
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();

    const backdrop = screen.getByTestId("page-blur");
    expect(backdrop).toHaveAttribute("data-visible", "false");
    await userEvent.hover(screen.getByRole("button", { name: /When/ }));
    expect(bar).toHaveAttribute("data-expanded", "true");
    // The rest of the page blurs while the bar is expanded.
    expect(backdrop).toHaveAttribute("data-visible", "true");
    await userEvent.unhover(bar);
    expect(bar).toHaveAttribute("data-expanded", "false");
    expect(backdrop).toHaveAttribute("data-visible", "false");

    await userEvent.click(screen.getByRole("button", { name: /Who/ }));
    await userEvent.unhover(bar);
    expect(bar).toHaveAttribute("data-expanded", "true");
    await userEvent.keyboard("{Escape}");
    // Focus is still inside the bar; it shrinks once focus leaves.
    expect(bar).toHaveAttribute("data-expanded", "true");
    await userEvent.click(document.body);
    expect(bar).toHaveAttribute("data-expanded", "false");
  });

  it("only rises above the sticky header while expanded", async () => {
    const { container } = renderWithIntl(<SearchBar today={TODAY} id="hero" />);
    const root = container.querySelector("#hero")!;
    expect(root).toHaveClass("z-0");
    expect(root).not.toHaveClass("z-50");
    await userEvent.hover(screen.getByRole("button", { name: /When/ }));
    expect(root).toHaveClass("z-50");
  });

  it("Where works as a keyboard combobox: arrows move, Enter picks without submitting", async () => {
    renderWithIntl(<SearchBar today={TODAY} />);
    const input = screen.getByRole("combobox", { name: "Where" });
    await userEvent.click(input);
    const [kigali, musanze] = await screen.findAllByRole("option");
    await userEvent.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", kigali.id);
    expect(kigali).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", musanze.id);
    await userEvent.keyboard("{ArrowUp}{Enter}");
    expect(input).toHaveValue("Kigali");
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the listbox in the DOM when nothing matches, so aria-controls always resolves", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ locations: [] }))));
    renderWithIntl(<SearchBar today={TODAY} />);
    const input = screen.getByRole("combobox", { name: "Where" });
    await userEvent.type(input, "zzz");
    expect(await screen.findByText(/No places match/)).toBeInTheDocument();
    expect(document.getElementById(input.getAttribute("aria-controls")!)).not.toBeNull();
  });

  it("phone sheets trap focus, lock page scroll and return focus on close", async () => {
    stubViewport(false);
    renderWithIntl(<SearchBar today={TODAY} />);
    const who = screen.getByRole("button", { name: /Who/ });
    await userEvent.click(who);
    const sheet = screen.getByRole("dialog", { name: "Who" });
    expect(sheet).toContainElement(document.activeElement as HTMLElement);
    expect(document.body.style.overflow).toBe("hidden");
    for (let i = 0; i < 12; i++) {
      await userEvent.tab();
      expect(sheet).toContainElement(document.activeElement as HTMLElement);
    }
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(document.body.style.overflow).toBe("");
    expect(who).toHaveFocus();
  });

  it("opens panels as full-screen dialogs on phones", async () => {
    stubViewport(false);
    renderWithIntl(<SearchBar today={TODAY} />);
    await userEvent.click(screen.getByRole("button", { name: /Who/ }));
    expect(screen.getByRole("dialog", { name: "Who" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
