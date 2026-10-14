import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { BookingCard, StayCalendar, StayProvider } from "./Booking";

const animateScrollTo = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/lib/animate-scroll", () => ({ animateScrollTo }));
const bookStayAction = vi.hoisted(() => vi.fn());
vi.mock("@/features/bookings/actions", () => ({ bookStayAction }));
const push = vi.hoisted(() => vi.fn());
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/listings/abc",
  useRouter: () => ({ push }),
  Link: ({ href, children, ...rest }: { href: { pathname: string; query: { next: string } }; children: ReactNode }) => (
    <a href={`${href.pathname}?next=${href.query.next}`} {...rest}>
      {children}
    </a>
  ),
}));

const rates = [
  { unit: "HOUR" as const, price: 9000, dayStartTime: "07:00", dayEndTime: "22:00", checkInTime: null, checkOutTime: null },
  { unit: "NIGHT" as const, price: 45000, dayStartTime: null, dayEndTime: null, checkInTime: "14:00", checkOutTime: "11:00" },
];
const place = { title: "Sunny studio", subtitle: "Room in Gasabo, Kigali · ★ 4.50", photo: null };

function setup({ discountPercent = 50 as number | null, signedIn = true, booked = [] as { checkIn: string; checkOut: string }[] } = {}) {
  renderWithIntl(
    <StayProvider listingId="abc" booked={booked} holdMinutes={30}>
      <StayCalendar city="Kigali" today="2026-10-13" />
      <BookingCard rates={rates} discountPercent={discountPercent} maxGuests={2} place={place} signedIn={signedIn} />
    </StayProvider>,
  );
}

async function pickDates() {
  await userEvent.click(screen.getByRole("button", { name: /October 14, 2026/ }));
  await userEvent.click(screen.getByRole("button", { name: /October 16, 2026/ }));
}

describe("Booking card", () => {
  it("shows the nightly price and the discount note before dates are chosen", () => {
    setup();
    const card = screen.getByRole("complementary");
    expect(card).toHaveTextContent("RWF 22,500");
    expect(card).toHaveTextContent("/ night");
    expect(screen.getByText("This host is offering a discount")).toBeInTheDocument();
    expect(screen.getByText("You won't be charged yet")).toBeInTheDocument();
  });

  it("prices the nights picked in the calendar, in the card", async () => {
    setup();
    await pickDates();
    expect(screen.getByRole("heading", { name: "2 nights in Kigali" })).toBeInTheDocument();
    const card = screen.getByRole("complementary");
    expect(card).toHaveTextContent("RWF 45,000 for 2 nights");
    expect(card).toHaveTextContent("RWF 22,500 × 2 nights");
    expect(card).toHaveTextContent("Total");
  });

  it("lists the other ways to rent", () => {
    setup({ discountPercent: null });
    expect(screen.getByRole("complementary")).toHaveTextContent("RWF 9,000 / hour");
    expect(screen.queryByText("This host is offering a discount")).not.toBeInTheDocument();
  });

  it("Reserve without dates takes you to the calendar", async () => {
    animateScrollTo.mockClear();
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));
    expect(animateScrollTo).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("signed-out visitors log in before reserving", () => {
    setup({ signedIn: false });
    expect(screen.getByRole("link", { name: "Reserve" })).toHaveAttribute("href", "/login?next=/listings/abc");
  });
});

describe("Confirm and pay", () => {
  // Long flow (types two phone numbers): a roomier limit so a busy machine doesn't time it out.
  it("walks through choosing mobile money, reviewing and booking, without charging yet", { timeout: 15_000 }, async () => {
    bookStayAction.mockResolvedValueOnce({ reference: "SR-7K2M9Q" });
    setup();
    await pickDates();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));
    const dialog = screen.getByRole("dialog", { name: "Confirm and pay" });

    // Summary: the place, dates, guests, nights × price and total (and the saving from the discount).
    expect(dialog).toHaveTextContent("Sunny studio");
    expect(dialog).toHaveTextContent("RWF 22,500 × 2 nights");
    expect(dialog).toHaveTextContent("You save RWF 45,000 on this stay");

    // Step 1: MTN chosen by default; an Airtel number is refused, an MTN one accepted.
    const number = within(dialog).getByLabelText("Mobile money number");
    await userEvent.type(number, "0731234567");
    await userEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("MTN Mobile Money numbers start with 078 or 079.");
    await userEvent.clear(number);
    await userEvent.type(number, "078 812 3456");
    await userEvent.click(within(dialog).getByRole("button", { name: "Next" }));

    // Step 2: review, with the chosen method summarised; booking holds the dates and nothing is charged yet.
    expect(dialog).toHaveTextContent("MTN Mobile Money · 078 ••• 3456");
    expect(dialog).toHaveTextContent("Free to cancel while the booking is unpaid.");
    expect(dialog).toHaveTextContent("We hold your dates for 30 minutes. Mobile money payment isn't connected yet, so you won't be charged.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Book and hold these dates" }));
    expect(bookStayAction).toHaveBeenCalledWith({
      listingId: "abc",
      checkIn: "2026-10-14",
      checkOut: "2026-10-16",
      guests: 1,
      payment: { method: "mtn", phone: "078 812 3456" },
    });
    expect(push).toHaveBeenCalledWith("/bookings/SR-7K2M9Q");
  });

  it("explains when the dates were just taken by someone else", async () => {
    bookStayAction.mockResolvedValueOnce({ error: "unavailable" });
    setup();
    await pickDates();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Mobile money number"), "0788123456");
    await userEvent.click(within(dialog).getByRole("button", { name: "Next" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Book and hold these dates" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Someone just booked some of these nights. Choose other dates.");
  });

  it("Change closes the window so dates can be edited on the page", async () => {
    setup();
    await pickDates();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));
    await userEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Change" })[0]!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Booked nights", () => {
  it("can't be picked in the calendar, and a stay can't run over them", async () => {
    setup({ booked: [{ checkIn: "2026-10-20", checkOut: "2026-10-23" }] });
    expect(screen.getByRole("button", { name: /October 20, 2026/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /October 22, 2026/ })).toBeDisabled();
    // The checkout morning of a booking is free for the next guest.
    expect(screen.getByRole("button", { name: /October 23, 2026/ })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: /October 18, 2026/ }));
    expect(screen.getByRole("button", { name: /October 20, 2026/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /October 21, 2026/ })).toBeDisabled();
  });
});
