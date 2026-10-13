import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { SaveButton } from "./SaveButton";

const { toggleFavoriteAction } = vi.hoisted(() => ({ toggleFavoriteAction: vi.fn() }));
vi.mock("@/features/favorites/actions", () => ({ toggleFavoriteAction }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/listings/abc",
  Link: ({ href, children, ...rest }: { href: string | { pathname: string; query: { next: string } }; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : `${href.pathname}?next=${href.query.next}`} {...rest}>
      {children}
    </a>
  ),
}));

const preview = { title: "Sunny flat", subtitle: "Room in Gasabo, Kigali", photo: null };

beforeEach(() => toggleFavoriteAction.mockReset());

describe("SaveButton", () => {
  it("sends signed-out visitors to log in first", () => {
    renderWithIntl(<SaveButton listingId="abc" initialSaved={false} signedIn={false} {...preview} />);
    expect(screen.getByRole("link", { name: "Save" })).toHaveAttribute("href", "/login?next=/listings/abc");
  });

  it("opens a save window, saves, and confirms with a link to favorites", async () => {
    toggleFavoriteAction.mockResolvedValue({ saved: true });
    renderWithIntl(<SaveButton listingId="abc" initialSaved={false} signedIn {...preview} />);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    const dialog = screen.getByRole("dialog", { name: "Save this place" });
    expect(dialog).toHaveTextContent("Sunny flat");
    await userEvent.click(screen.getByRole("button", { name: "Save to Favorites" }));
    expect(toggleFavoriteAction).toHaveBeenCalledWith("abc");
    expect(await screen.findByText("Saved to Favorites")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View favorites" })).toHaveAttribute("href", "/favorites");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument();
  });

  it("can remove a saved place, and reports failures", async () => {
    toggleFavoriteAction.mockResolvedValue({ error: "failed" });
    renderWithIntl(<SaveButton listingId="abc" initialSaved signedIn {...preview} />);
    await userEvent.click(screen.getByRole("button", { name: "Saved" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove from Favorites" }));
    expect(await screen.findByText("Couldn't update your favorites. Try again.")).toBeInTheDocument();
  });
});
