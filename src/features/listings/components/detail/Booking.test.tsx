import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/render";
import { BookingCard, StayCalendar, StayProvider } from "./Booking";

const rates = [
  { unit: "HOUR" as const, price: 9000, dayStartTime: "07:00", dayEndTime: "22:00", checkInTime: null, checkOutTime: null },
  { unit: "NIGHT" as const, price: 45000, dayStartTime: null, dayEndTime: null, checkInTime: "14:00", checkOutTime: "11:00" },
];

function setup(discountPercent: number | null = 50) {
  renderWithIntl(
    <StayProvider>
      <StayCalendar city="Kigali" today="2026-10-13" />
      <BookingCard rates={rates} discountPercent={discountPercent} maxGuests={2} />
    </StayProvider>,
  );
}

describe("Booking", () => {
  it("shows the nightly price and the discount note before dates are chosen", () => {
    setup();
    const card = screen.getByRole("complementary");
    expect(card).toHaveTextContent("RWF 22,500");
    expect(card).toHaveTextContent("/ night");
    expect(screen.getByText("This host is offering a discount")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reserve" })).toBeDisabled();
    expect(screen.getByText("Online booking opens soon.")).toBeInTheDocument();
  });

  it("prices the nights picked in the calendar, in the card", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: /October 14, 2026/ }));
    await userEvent.click(screen.getByRole("button", { name: /October 16, 2026/ }));
    expect(screen.getByRole("heading", { name: "2 nights in Kigali" })).toBeInTheDocument();
    const card = screen.getByRole("complementary");
    expect(card).toHaveTextContent("RWF 45,000 for 2 nights");
    expect(card).toHaveTextContent("RWF 22,500 × 2 nights");
    expect(card).toHaveTextContent("Total");
    expect(card).toHaveTextContent(/Wed, Oct 14|10\/14\/2026|Oct 14/);
  });

  it("lists the other ways to rent", () => {
    setup(null);
    expect(screen.getByRole("complementary")).toHaveTextContent("RWF 9,000 / hour");
    expect(screen.queryByText("This host is offering a discount")).not.toBeInTheDocument();
  });
});
