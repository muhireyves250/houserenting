import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { BookingCard, RoomPicker, StayCalendar, StayProvider } from "./Booking";

const animateScrollTo = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/lib/animate-scroll", () => ({ animateScrollTo }));
const bookRentalAction = vi.hoisted(() => vi.fn());
const bookStayAction = bookRentalAction;
const checkPromoAction = vi.hoisted(() => vi.fn());
vi.mock("@/features/bookings/actions", () => ({ bookRentalAction, checkPromoAction }));
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
    expect(screen.getByText("This place has a discount")).toBeInTheDocument();
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

  it("offers each way the host rents the place, with its price", async () => {
    setup({ discountPercent: null });
    expect(screen.getByRole("radio", { name: "By the night" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "By the hour" }));
    expect(screen.getByRole("complementary")).toHaveTextContent("RWF 9,000/ hour");
    expect(screen.queryByText("This place has a discount")).not.toBeInTheDocument();
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
    const dialog = screen.getByRole("dialog", { name: "Your reservation" });

    // Summary: the place, dates, guests, nights × price and total (and the saving from the discount).
    expect(dialog).toHaveTextContent("Sunny studio");
    expect(dialog).toHaveTextContent("RWF 22,500 × 2 nights");
    expect(dialog).toHaveTextContent("You save RWF 45,000 on this stay");

    // Screen 1: the reservation (cancellation terms included); then on to payment.
    expect(dialog).toHaveTextContent("Free to cancel while the booking is unpaid.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue to payment" }));
    expect(dialog).toHaveTextContent("Step 2 of 2");

    // Screen 2: MTN chosen by default; an Airtel number is refused, an MTN one accepted; no company (EBM by phone).
    expect(dialog).toHaveTextContent("your EBM receipt is sent to your phone number");
    const number = within(dialog).getByLabelText("Mobile money number");
    await userEvent.type(number, "0731234567");
    await userEvent.click(within(dialog).getByRole("button", { name: /^Pay/ }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("MTN Mobile Money numbers start with 078 or 079.");
    await userEvent.clear(number);
    await userEvent.type(number, "078 812 3456");
    expect(dialog).toHaveTextContent("We hold your dates for 30 minutes.");
    await userEvent.click(within(dialog).getByRole("button", { name: /^Pay/ }));
    expect(bookRentalAction).toHaveBeenCalledWith({
      listingId: "abc",
      unit: "NIGHT",
      start: "2026-10-14",
      startTime: null,
      quantity: 2,
      guests: 1,
      roomId: null,
      roomNumber: null,
      promoCode: null,
      payment: { method: "mtn", phone: "078 812 3456" },
      identity: null,
      company: null,
    });
    expect(push).toHaveBeenCalledWith("/bookings/SR-7K2M9Q");
  });

  it("explains when the dates were just taken by someone else", async () => {
    bookStayAction.mockResolvedValueOnce({ error: "unavailable" });
    setup();
    await pickDates();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue to payment" }));
    await userEvent.type(within(dialog).getByLabelText("Mobile money number"), "0788123456");
    await userEvent.click(within(dialog).getByRole("button", { name: /^Pay/ }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Some of these dates aren't available any more. Choose other dates.");
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

describe("Rooms and fees", () => {
  const rooms = [
    { id: "r1", name: "Garden room", description: "", maxGuests: 2, facilities: [], rates: [{ unit: "NIGHT" as const, price: 20000 }] },
    { id: "r2", name: "Lake room", description: "", maxGuests: 3, facilities: [], rates: [{ unit: "NIGHT" as const, price: 30000 }] },
  ];

  it("asks for a room first, then prices that room with the service fee in one total", async () => {
    renderWithIntl(
      <StayProvider listingId="abc" rooms={rooms} bookingModel="ROOM_BY_ROOM" guestFeeBps={500} booked={[{ checkIn: "2026-10-20", checkOut: "2026-10-23", roomId: "r1" }]}>
        <RoomPicker wholeRates={[]} />
        <StayCalendar city="Kigali" today="2026-10-13" />
        <BookingCard rates={rates} discountPercent={null} maxGuests={6} place={place} signedIn />
      </StayProvider>,
    );
    expect(screen.getByRole("button", { name: "Choose a room" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Garden room/ }));
    // The garden room is taken on the 20th–22nd; the lake room isn't.
    expect(screen.getByRole("button", { name: /October 21, 2026/ })).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: /Lake room/ }));
    expect(screen.getByRole("button", { name: /October 21, 2026/ })).toBeEnabled();
    await pickDates();
    // 2 nights × 30,000 = 60,000, plus a 5% service fee = 63,000, shown as one total (no fee row).
    expect(screen.queryByText("Service fee")).toBeNull();
    expect(screen.getByText("Total").nextSibling).toHaveTextContent("RWF 63,000");
    expect(screen.getByText("All fees included")).toBeInTheDocument();
    expect(screen.getByText("Room:").parentElement).toHaveTextContent("Room: Lake room");
  });
});

describe("Promo codes in the Reserve window", () => {
  it("shows the discount and books with the code", async () => {
    checkPromoAction.mockResolvedValueOnce({ discount: 4500 });
    bookStayAction.mockResolvedValueOnce({ reference: "SR-7K2M9Q" });
    setup();
    await pickDates();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue to payment" }));
    await userEvent.type(within(dialog).getByLabelText("Promo code"), "welcome");
    await userEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    expect(await within(dialog).findByText("Promo WELCOME")).toBeInTheDocument();
    // 2 nights × 22,500 = 45,000, less 4,500.
    expect(within(dialog).getByText("Total").nextSibling).toHaveTextContent("RWF 40,500");
    await userEvent.type(within(dialog).getByLabelText("Mobile money number"), "0788123456");
    await userEvent.click(within(dialog).getByRole("button", { name: /^Pay/ }));
    expect(bookStayAction).toHaveBeenLastCalledWith(expect.objectContaining({ promoCode: "WELCOME" }));
  });
});

describe("Booking by the hour", () => {
  it("asks for a date, a start time and hours, and prices the hours", async () => {
    bookRentalAction.mockResolvedValueOnce({ reference: "SR-HHHHHH" });
    renderWithIntl(
      <StayProvider listingId="abc" defaultUnit="NIGHT">
        <StayCalendar city="Kigali" rates={rates} today="2026-10-13" />
        <BookingCard rates={rates} discountPercent={null} maxGuests={2} place={place} signedIn />
      </StayProvider>,
    );
    await userEvent.click(screen.getByRole("radio", { name: "By the hour" }));
    // The night calendar goes away; the card asks for a date, a time and hours.
    expect(screen.queryByRole("button", { name: /October 14, 2026/ })).not.toBeInTheDocument();
    // The date: our calendar opens (booked and closed days can't be picked); a day a week ahead.
    const ahead = new Date(Date.now() + 7 * 86_400_000);
    const dayName = ahead.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Africa/Kigali" });
    await userEvent.click(screen.getByRole("button", { name: /^Date/ }));
    // Move to its month if needed, then tap it.
    for (let i = 0; i < 2 && !screen.queryByRole("button", { name: new RegExp(dayName) }); i++) await userEvent.click(screen.getAllByRole("button", { name: /next month/i })[0]!);
    await userEvent.click(screen.getByRole("button", { name: new RegExp(dayName) }));
    // VIIPA's own dropdowns: open, then pick.
    await userEvent.click(screen.getByRole("combobox", { name: "Start time" }));
    await userEvent.click(screen.getByRole("option", { name: "09:00" }));
    await userEvent.click(screen.getByRole("combobox", { name: "Length" }));
    await userEvent.click(screen.getByRole("option", { name: /^3/ }));
    expect(screen.getByText("RWF 9,000 × 3 hours")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(`${ahead.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Africa/Kigali" })} · 9:00`);
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue to payment" }));
    await userEvent.type(within(dialog).getByLabelText("Mobile money number"), "0788123456");
    await userEvent.click(within(dialog).getByRole("button", { name: /^Pay/ }));
    expect(bookRentalAction).toHaveBeenLastCalledWith(expect.objectContaining({ unit: "HOUR", start: new Date(ahead.getTime() + 2 * 3_600_000).toISOString().slice(0, 10), startTime: "09:00", quantity: 3 }));
  });
});

describe("Booking for a company", () => {
  it("asks the TIN, then the purchase code, and sends them for the EBM invoice", async () => {
    bookStayAction.mockResolvedValueOnce({ reference: "SR-CO1234" });
    setup();
    await pickDates();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue to payment" }));
    await userEvent.type(within(dialog).getByLabelText("Mobile money number"), "0788123456");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /Booking for a company/ }));
    await userEvent.type(within(dialog).getByLabelText("TIN (9 digits)"), "111122233");
    // TIN given: the purchase code is required before paying.
    expect(within(dialog).getByRole("button", { name: /^Pay/ })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Purchase code * required"), "PC-98234");
    await userEvent.click(within(dialog).getByRole("button", { name: /^Pay/ }));
    expect(bookStayAction).toHaveBeenLastCalledWith(expect.objectContaining({ company: { tin: "111122233", purchaseCode: "PC-98234" } }));
  });
});
