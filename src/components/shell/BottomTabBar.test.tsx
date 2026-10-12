import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { BottomTabBar } from "./BottomTabBar";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/favorites",
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("BottomTabBar", () => {
  it("renders the five tabs with translated labels", () => {
    renderWithIntl(<BottomTabBar />, "fr");
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    expect(nav.querySelectorAll("a")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Rechercher" })).toHaveAttribute("href", "/");
  });

  it("marks only the current tab as the current page", () => {
    renderWithIntl(<BottomTabBar />);
    expect(screen.getByRole("link", { name: "Favorites" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Search" })).not.toHaveAttribute("aria-current");
  });
});
