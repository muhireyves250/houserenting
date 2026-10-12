import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { HomeSearch } from "./HomeSearch";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push }) }));

describe("HomeSearch", () => {
  beforeEach(() => push.mockReset());

  it("submits a short-term search", async () => {
    renderWithIntl(<HomeSearch />);
    await userEvent.type(screen.getByLabelText("Location"), "Kigali");
    await userEvent.type(screen.getByLabelText("Number of guests"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith({ pathname: "/search", query: { mode: "short", location: "Kigali", guests: "2" } });
  });

  it("hides dates and guests for 'From 6 months'", async () => {
    renderWithIntl(<HomeSearch />);
    await userEvent.click(screen.getByRole("radio", { name: "From 6 months" }));
    expect(screen.queryByLabelText("Check-in")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Number of guests")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Location"), "Musanze");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(push).toHaveBeenCalledWith({ pathname: "/search", query: { mode: "long", location: "Musanze" } });
  });
});
