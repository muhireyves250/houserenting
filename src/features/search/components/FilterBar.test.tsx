import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { FilterBar } from "./FilterBar";

const push = vi.fn();
// The bar replaces the URL in place (no scroll jump); `push` names the spy for brevity.
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace: (...args: unknown[]) => push(args[0]) }) }));

const base = { mode: "short", location: "Kigali" };

beforeEach(() => push.mockReset());

describe("FilterBar", () => {
  it("filters by type of place, keeping the rest of the search", async () => {
    renderWithIntl(<FilterBar base={base} mode="short" filters={{}} />);
    await userEvent.click(screen.getByRole("button", { name: "Type of place" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Lodge" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Room" }));
    await userEvent.click(screen.getByRole("button", { name: "Show results" }));
    expect(push).toHaveBeenCalledWith({ pathname: "/search", query: { ...base, type: "LODGE,ROOM" } });
  });

  it("filters by price range", async () => {
    renderWithIntl(<FilterBar base={base} mode="short" filters={{ types: ["ROOM"] }} />);
    await userEvent.click(screen.getByRole("button", { name: "Price" }));
    await userEvent.type(screen.getByLabelText("Minimum"), "20000");
    await userEvent.type(screen.getByLabelText("Maximum"), "90000");
    await userEvent.click(screen.getByRole("button", { name: "Show results" }));
    expect(push).toHaveBeenCalledWith({ pathname: "/search", query: { ...base, type: "ROOM", minPrice: "20000", maxPrice: "90000" } });
  });

  it("shows active filters and clears them all", async () => {
    renderWithIntl(<FilterBar base={base} mode="short" filters={{ types: ["ROOM", "LODGE"], maxPrice: 50000 }} />);
    expect(screen.getByRole("button", { name: /Type of place/ })).toHaveTextContent("2");
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(push).toHaveBeenCalledWith({ pathname: "/search", query: base });
  });
});

describe("FilterBar hover", () => {
  it("slides one shade behind the hovered filter and fades it out on leave", async () => {
    renderWithIntl(<FilterBar base={base} mode="short" filters={{}} />);
    const shade = screen.getByTestId("filter-hover");
    expect(shade).toHaveAttribute("data-visible", "false");
    await userEvent.hover(screen.getByRole("button", { name: "Type of place" }));
    expect(shade).toHaveAttribute("data-visible", "true");
    await userEvent.unhover(screen.getByRole("button", { name: "Type of place" }));
    expect(shade).toHaveAttribute("data-visible", "false");
  });
});
