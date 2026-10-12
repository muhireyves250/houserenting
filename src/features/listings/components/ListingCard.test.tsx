import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import type { ListingCardData } from "../service";
import { ListingCard } from "./ListingCard";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: { pathname: string; params: { id: string } } | string; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : href.pathname.replace("[id]", href.params.id)} {...rest}>
      {children}
    </a>
  ),
}));

const base: ListingCardData = {
  id: "abc",
  title: "Flat T1, Av. António Augusto de Aguiar",
  type: "APARTMENT",
  city: "Kigali",
  district: "Gasabo",
  maxGuests: 4,
  discountPercent: 50,
  ratingAvg: 4.5,
  ratingCount: 12,
  publishedAt: new Date("2026-01-01T00:00:00Z"),
  photos: [{ url: "https://images.unsplash.com/photo-1", width: 1600, height: 1067 }],
  rates: [
    { unit: "NIGHT", price: 1800 },
    { unit: "MONTH", price: 900000 },
  ],
};

describe("ListingCard", () => {
  it("links to the listing and shows title, place and photo", () => {
    renderWithIntl(<ListingCard listing={base} mode="short" />);
    const link = screen.getByRole("link", { name: /Flat T1/ });
    expect(link).toHaveAttribute("href", "/listings/abc");
    expect(screen.getByText("Gasabo, Kigali")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Flat T1, Av. António Augusto de Aguiar, photo 1" })).toBeInTheDocument();
  });

  it("shows the discounted headline price with the original struck through", () => {
    renderWithIntl(<ListingCard listing={base} mode="short" />);
    expect(screen.getByText("RWF 900")).toBeInTheDocument();
    expect(screen.getByText("/ night")).toBeInTheDocument();
    expect(screen.getByText("RWF 1,800").tagName).toBe("S");
    expect(screen.getByText("-50%")).toBeInTheDocument();
  });

  it("uses the monthly rate for long-term searches", () => {
    renderWithIntl(<ListingCard listing={{ ...base, discountPercent: null }} mode="long" />);
    expect(screen.getByText("RWF 900,000")).toBeInTheDocument();
    expect(screen.getByText("/ month")).toBeInTheDocument();
    expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
  });

  it("shows the rating when reviewed, or a New badge for fresh unreviewed listings", () => {
    renderWithIntl(<ListingCard listing={base} mode="short" />);
    expect(screen.getByLabelText("Rated 4.5 out of 5")).toBeInTheDocument();

    renderWithIntl(<ListingCard listing={{ ...base, id: "new", ratingCount: 0, ratingAvg: 0, publishedAt: new Date() }} mode="short" />);
    expect(screen.getByText("New")).toBeInTheDocument();
  });
});
