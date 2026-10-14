import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSearchState } from "@/features/search/search-store";
import { renderWithIntl } from "@/test/render";
import { MobileSearch } from "./MobileSearch";

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => {
  resetSearchState();
  push.mockReset();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ locations: [{ city: "Kigali", count: 3, photo: null }] }))));
});
afterEach(() => vi.unstubAllGlobals());

describe("MobileSearch", () => {
  it("opens a full-screen search from the pill, steps Where → When → Who, and searches", async () => {
    renderWithIntl(<MobileSearch today="2026-10-12" />);
    await userEvent.click(screen.getByRole("button", { name: "Start your search" }));
    const sheet = screen.getByRole("dialog", { name: "Start your search" });
    expect(within(sheet).getByRole("heading", { name: "Where?" })).toBeInTheDocument();

    await userEvent.click(await within(sheet).findByRole("option", { name: /Kigali/ }));
    expect(within(sheet).getByRole("heading", { name: "When?" })).toBeInTheDocument();
    // The finished step collapses to a summary row.
    expect(within(sheet).getByRole("button", { name: /Where Kigali/ })).toBeInTheDocument();

    await userEvent.click(within(sheet).getByRole("button", { name: /Who/ }));
    expect(within(sheet).getByRole("heading", { name: "Who?" })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: "Add one: Adults" }));

    await userEvent.click(within(sheet).getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith({ pathname: "/search", query: { mode: "short", location: "Kigali", guests: "1" } });
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("clears everything and closes with the close button", async () => {
    renderWithIntl(<MobileSearch today="2026-10-12" />);
    await userEvent.click(screen.getByRole("button", { name: "Start your search" }));
    await userEvent.type(screen.getByRole("combobox", { name: "Where" }), "Musanze");
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByRole("combobox", { name: "Where" })).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Close search" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
