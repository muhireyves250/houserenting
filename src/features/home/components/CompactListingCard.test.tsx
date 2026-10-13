import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ListingCardData } from "@/features/listings/service";
import { renderWithIntl } from "@/test/render";
import { CompactListingCard } from "./CompactListingCard";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string | { pathname: string }; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/",
}));
vi.mock("@/features/favorites/actions", () => ({ toggleFavoriteAction: vi.fn() }));

const base: ListingCardData = {
  id: "abc",
  title: "Sunny flat",
  type: "APARTMENT",
  city: "Kigali",
  district: "Gasabo",
  maxGuests: 4,
  discountPercent: null,
  ratingAvg: 4.92,
  ratingCount: 25,
  publishedAt: new Date("2026-01-01T00:00:00Z"),
  photos: [{ url: "https://images.unsplash.com/photo-1", width: 1600, height: 1067 }],
  rates: [
    { unit: "NIGHT", price: 50000 },
    { unit: "MONTH", price: 900000 },
  ],
};

describe("CompactListingCard", () => {
  it("shows type and city, the 2-night price, rating, badge and heart", () => {
    renderWithIntl(<CompactListingCard listing={base} mode="short" signedIn={false} saved={false} />);
    expect(screen.getByRole("link", { name: /Apartment in Kigali/ })).toHaveAttribute("href", "/listings/abc");
    expect(screen.getByText(/for 2 nights/)).toHaveTextContent(/100,000/);
    expect(screen.getByLabelText("Rated 4.92 out of 5")).toBeInTheDocument();
    expect(screen.getByText("Guest favorite")).toBeInTheDocument();
    expect(screen.getByText("Sunny flat")).toBeInTheDocument();
    expect(screen.getByText("Gasabo")).toBeInTheDocument();
    expect(screen.getByText("Up to 4 guests")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Save Sunny flat" })).toBeInTheDocument();
  });

  it("shows the monthly price for long stays and no badge for few reviews", () => {
    renderWithIntl(<CompactListingCard listing={{ ...base, ratingCount: 3 }} mode="long" signedIn saved />);
    expect(screen.getByText(/\/ month/)).toHaveTextContent(/900,000/);
    expect(screen.queryByText("Guest favorite")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Sunny flat from favorites" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("CompactListingCard hover slide", () => {
  it("stacks the next photo behind the cover so hover can slide to it", () => {
    const photos = [...base.photos, { url: "https://images.unsplash.com/photo-2", width: 1600, height: 1067 }];
    const { container } = renderWithIntl(<CompactListingCard listing={{ ...base, photos }} mode="short" signedIn={false} saved={false} />);
    expect(screen.getByRole("img", { name: "Sunny flat, photo 1" })).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(container.querySelector('[data-slide="next"]')).not.toBeNull();
  });
});
