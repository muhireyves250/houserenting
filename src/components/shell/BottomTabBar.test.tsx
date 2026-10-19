import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { BottomTabBar } from "./BottomTabBar";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/orders",
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
    expect(screen.getByRole("link", { name: "Accueil" })).toHaveAttribute("href", "/");
  });

  it("marks only the current tab as the current page", () => {
    renderWithIntl(<BottomTabBar />);
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("shows every tab's name under its icon, with the current one on the sliding pill", () => {
    renderWithIntl(<BottomTabBar />);
    expect(screen.getByRole("link", { name: "Orders" })).toHaveTextContent("Orders");
    expect(screen.queryByRole("link", { name: "Saved" })).toBeNull();
    expect(screen.getByRole("link", { name: "My stay" })).toHaveTextContent("My stay");
    expect(screen.getByTestId("tab-pill")).toBeInTheDocument();
  });
});
