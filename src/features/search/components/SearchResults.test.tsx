import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ListingCardData } from "@/features/listings/service";
import { renderWithIntl } from "@/test/render";
import { SearchResults } from "./SearchResults";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string | { pathname: string }; children: ReactNode }) => (
    <a href={typeof href === "string" ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/search",
}));
vi.mock("@/features/favorites/actions", () => ({ toggleFavoriteAction: vi.fn() }));
// Stand-in for the Leaflet map: one button per pin that reports hover.
vi.mock("next/dynamic", () => ({
  default: () =>
    function MapStub({ listings, onActive }: { listings: ListingCardData[]; onActive: (id: string | null) => void }) {
      return (
        <div data-testid="map">
          {listings.map((l) => (
            <button key={l.id} type="button" onMouseEnter={() => onActive(l.id)}>
              pin {l.id}
            </button>
          ))}
        </div>
      );
    },
}));

const listing = (id: string): ListingCardData => ({
  id,
  title: `Home ${id}`,
  type: "APARTMENT",
  city: "Kigali",
  district: "Gasabo",
  maxGuests: 2,
  bedrooms: 1,
  bathrooms: 1,
  lat: -1.95,
  lng: 30.06,
  discountPercent: null,
  ratingAvg: 0,
  ratingCount: 0,
  publishedAt: null,
  photos: [],
  rates: [{ unit: "NIGHT", price: 20000 }],
});

describe("SearchResults", () => {
  it("toggles between list and map on phones", async () => {
    renderWithIntl(<SearchResults listings={[listing("a")]} mode="short" signedIn={false} savedIds={[]} header={null} empty={null} />);
    const map = screen.getByTestId("map").parentElement!;
    expect(map).toHaveClass("hidden");
    await userEvent.click(screen.getByRole("button", { name: "Show map" }));
    expect(map).not.toHaveClass("hidden");
    expect(screen.getByRole("button", { name: "Show list" })).toBeInTheDocument();
  });

  it("frames the card whose pin is hovered", async () => {
    renderWithIntl(<SearchResults listings={[listing("a"), listing("b")]} mode="short" signedIn={false} savedIds={[]} header={null} empty={null} />);
    await userEvent.hover(screen.getByRole("button", { name: "pin b" }));
    const [first, second] = screen.getAllByRole("listitem");
    expect(second).toHaveClass("ring-primary/50");
    expect(first).not.toHaveClass("ring-primary/50");
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<SearchResults listings={[]} mode="short" signedIn={false} savedIds={[]} header={<h1>Homes</h1>} empty={<p>Nothing here</p>} />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});
