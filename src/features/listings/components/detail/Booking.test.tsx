import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { BookingCard, StayCalendar, StayProvider } from "./Booking";

const animateScrollTo = vi.hoisted(() => vi.fn(() => Promise.resolve()));
vi.mock("@/lib/animate-scroll", () => ({ animateScrollTo }));
vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/listings/abc",
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

function setup({ discountPercent = 50 as number | null, signedIn = true } = {}) {
  renderWithIntl(
    <StayProvider>
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
  it("walks through paying with mobile money and reviewing, without charging yet", async () => {
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

    // Step 2: review, with the chosen method summarised and payment not live yet.
    expect(dialog).toHaveTextContent("MTN Mobile Money · 078 ••• 3456");
    expect(within(dialog).getByRole("button", { name: "Confirm and pay" })).toBeDisabled();
    expect(dialog).toHaveTextContent("Mobile money payments open soon. You won't be charged.");
  });

  it("Change closes the window so dates can be edited on the page", async () => {
    setup();
    await pickDates();
    await userEvent.click(screen.getByRole("button", { name: "Reserve" }));
    await userEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Change" })[0]!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
