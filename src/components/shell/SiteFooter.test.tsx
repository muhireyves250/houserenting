import { screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { SiteFooter } from "./SiteFooter";

type Href = string | { pathname: string; query?: Record<string, string> };
const toUrl = (href: Href) =>
  typeof href === "string" ? href : `${href.pathname}${href.query ? `?${new URLSearchParams(href.query)}` : ""}`;

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/search",
  Link: ({ href, locale, children, ...rest }: { href: Href; locale?: string; children: ReactNode }) => (
    <a href={locale ? `/${locale}${toUrl(href)}` : toUrl(href)} {...rest}>
      {children}
    </a>
  ),
}));

describe("SiteFooter", () => {
  it("links destinations to their searches", () => {
    renderWithIntl(<SiteFooter signedIn year={2026} />);
    expect(screen.getByRole("link", { name: "Kigali" })).toHaveAttribute("href", "/search?mode=short&location=Kigali");
    expect(screen.getByRole("link", { name: "Long stays" })).toHaveAttribute("href", "/search?mode=long");
    expect(screen.getByRole("link", { name: "Short stays" })).toHaveAttribute("href", "/search?mode=short");
    expect(screen.getByRole("link", { name: "Start searching" })).toHaveAttribute("href", "/");
    expect(screen.getByText("© 2026 Space Rental. All rights reserved.")).toBeInTheDocument();
  });

  it("sends signed-out visitors to log in before account pages", () => {
    renderWithIntl(<SiteFooter signedIn={false} year={2026} />);
    expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/login?next=%2Ffavorites");
  });

  it("switches language on the current page and marks the current one", () => {
    renderWithIntl(<SiteFooter signedIn year={2026} />, "fr");
    const languages = screen.getByRole("navigation", { name: "Langue" });
    expect(within(languages).getByRole("link", { name: "Ikinyarwanda" })).toHaveAttribute("href", "/rw/search");
    expect(within(languages).getByRole("link", { name: "Français" })).toHaveAttribute("aria-current", "true");
  });
});
