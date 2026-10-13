import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { RecentlyViewedRow, TrackView } from "./RecentlyViewed";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string | { pathname: string }; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
}));

const home = { id: "abc", title: "Sunny flat", type: "APARTMENT", city: "Kigali", photo: null, ratingAvg: 4.8, ratingCount: 9 };

beforeEach(() => localStorage.clear());

describe("Recently viewed", () => {
  it("shows nothing until a home has been viewed, then lists it", () => {
    renderWithIntl(<RecentlyViewedRow />);
    expect(screen.queryByText("Recently viewed")).not.toBeInTheDocument();
    act(() => {
      render(<TrackView listing={home} />);
    });
    expect(screen.getByRole("heading", { name: "Recently viewed" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Kigali, Rwanda/ })).toHaveAttribute("href", "/listings/abc");
    expect(screen.getByText("4.80")).toBeInTheDocument();
  });
});
