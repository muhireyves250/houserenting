import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import type { BookingTileData } from "./BookingTile";
import { BookingsTabs } from "./BookingsTabs";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const tile = (reference: string, title: string, status: BookingTileData["status"], statusLabel: string): BookingTileData => ({
  reference,
  status,
  statusLabel,
  title,
  place: "Apartment · Gasabo, Kigali",
  photo: null,
  dates: "Oct 20 – 23, 2026",
  meta: "3 nights · 2 guests",
  note: null,
});
const labels = { upcoming: "Upcoming", past: "Past", noUpcoming: "No upcoming bookings", noPast: "No past bookings", group: "Bookings" };

describe("BookingsTabs", () => {
  it("shows upcoming bookings first and switches to past ones", async () => {
    renderWithIntl(
      <BookingsTabs
        upcoming={[tile("SR-AAAAAA", "Lake house", "PENDING_PAYMENT", "Awaiting payment")]}
        past={[tile("SR-BBBBBB", "City flat", "EXPIRED", "Hold expired")]}
        labels={labels}
      />,
    );
    expect(screen.getByRole("radio", { name: "Upcoming · 1" })).toBeChecked();
    expect(screen.getByRole("link", { name: /Lake house/ })).toHaveAttribute("href", "/bookings/SR-AAAAAA");
    expect(screen.getByText("Awaiting payment")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Past · 1" }));
    expect(screen.queryByText("Lake house")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /City flat/ })).toHaveAttribute("href", "/bookings/SR-BBBBBB");
  });

  it("opens on Past when nothing is coming up", () => {
    renderWithIntl(<BookingsTabs upcoming={[]} past={[tile("SR-BBBBBB", "City flat", "CANCELLED", "Cancelled")]} labels={labels} />);
    expect(screen.getByRole("radio", { name: "Past · 1" })).toBeChecked();
  });
});
