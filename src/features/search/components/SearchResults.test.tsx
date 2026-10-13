import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ListingCardData } from "@/features/listings/service";
import { renderWithIntl } from "@/test/render";
import { SearchResults } from "./SearchResults";

const replace = vi.hoisted(() => vi.fn());
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
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
    function MapStub({
      listings,
      onActive,
      onBoundsChange,
    }: {
      listings: ListingCardData[];
      onActive: (id: string | null) => void;
      onBoundsChange: (bbox: [number, number, number, number]) => void;
    }) {
      return (
        <div data-testid="map">
          <button type="button" onClick={() => onBoundsChange([-2.05, 29.95, -1.85, 30.2])}>
            move map
          </button>
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
  it("shows the home count on the phone list sheet", () => {
    renderWithIntl(<SearchResults listings={[listing("a")]} mode="short" signedIn={false} savedIds={[]} query={{ mode: "short" }} countLabel="1 home" empty={null} />);
    expect(screen.getByText("1 home")).toBeInTheDocument();
    expect(screen.getByTestId("map")).toBeInTheDocument();
  });

  it("frames the card whose pin is hovered", async () => {
    renderWithIntl(<SearchResults listings={[listing("a"), listing("b")]} mode="short" signedIn={false} savedIds={[]} query={{ mode: "short", location: "Kigali" }} empty={null} />);
    await userEvent.hover(screen.getByRole("button", { name: "pin b" }));
    const [first, second] = screen.getAllByRole("listitem");
    expect(second).toHaveClass("ring-primary/50");
    expect(first).not.toHaveClass("ring-primary/50");
  });

  it("shows the empty state when nothing matches", () => {
    renderWithIntl(<SearchResults listings={[]} mode="short" signedIn={false} savedIds={[]} query={{ mode: "short" }} empty={<p>Nothing here</p>} />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("uses the map as the filter: moving it searches that area instead of the typed place", async () => {
    replace.mockReset();
    renderWithIntl(<SearchResults listings={[listing("a")]} mode="short" signedIn={false} savedIds={[]} query={{ mode: "short", location: "Kigali", type: "ROOM" }} empty={null} />);
    expect(screen.getByRole("checkbox", { name: "Search as I move the map" })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "move map" }));
    expect(replace).toHaveBeenCalledWith({ pathname: "/search", query: { mode: "short", type: "ROOM", bbox: "-2.05,29.95,-1.85,30.2" } }, { scroll: false });
  });

  it("leaves the results alone when Search as I move the map is off", async () => {
    replace.mockReset();
    renderWithIntl(<SearchResults listings={[listing("a")]} mode="short" signedIn={false} savedIds={[]} query={{ mode: "short" }} empty={null} />);
    await userEvent.click(screen.getByRole("checkbox", { name: "Search as I move the map" }));
    await userEvent.click(screen.getByRole("button", { name: "move map" }));
    expect(replace).not.toHaveBeenCalled();
  });
});
