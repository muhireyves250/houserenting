import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { FavoriteButton } from "./FavoriteButton";

const { toggleFavoriteAction } = vi.hoisted(() => ({ toggleFavoriteAction: vi.fn() }));
vi.mock("@/features/favorites/actions", () => ({ toggleFavoriteAction }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/search",
  Link: ({ href, children, ...rest }: { href: { pathname: string; query: { next: string } }; children: ReactNode }) => (
    <a href={`${href.pathname}?next=${href.query.next}`} {...rest}>
      {children}
    </a>
  ),
}));

describe("FavoriteButton", () => {
  beforeEach(() => toggleFavoriteAction.mockReset());

  it("asks signed-out visitors to log in (modal) and brings them back", () => {
    renderWithIntl(<FavoriteButton listingId="a" title="Volcano lodge" initialSaved={false} signedIn={false} />);
    expect(screen.getByRole("link", { name: "Save Volcano lodge" })).toHaveAttribute("href", "/login?next=/search");
  });

  it("saves instantly for signed-in users", async () => {
    toggleFavoriteAction.mockResolvedValue({ saved: true });
    renderWithIntl(<FavoriteButton listingId="a" title="Volcano lodge" initialSaved={false} signedIn />);
    const button = screen.getByRole("button", { name: "Save Volcano lodge" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    expect(toggleFavoriteAction).toHaveBeenCalledWith("a");
    expect(screen.getByRole("button", { name: "Remove Volcano lodge from favorites" })).toHaveAttribute("aria-pressed", "true");
  });

  it("undoes the optimistic change if saving fails", async () => {
    toggleFavoriteAction.mockResolvedValue({ error: "failed" });
    renderWithIntl(<FavoriteButton listingId="a" title="Volcano lodge" initialSaved={false} signedIn />);
    await userEvent.click(screen.getByRole("button", { name: "Save Volcano lodge" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save Volcano lodge" })).toHaveAttribute("aria-pressed", "false"));
  });
});

describe("FavoriteButton label variant", () => {
  it("shows Save / Saved text next to the heart", async () => {
    toggleFavoriteAction.mockResolvedValue({ saved: true });
    renderWithIntl(<FavoriteButton variant="label" listingId="abc" title="Sunny flat" initialSaved={false} signedIn />);
    const button = screen.getByRole("button", { name: "Save Sunny flat" });
    expect(button).toHaveTextContent("Save");
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Remove Sunny flat from favorites" })).toHaveTextContent("Saved");
  });
});
