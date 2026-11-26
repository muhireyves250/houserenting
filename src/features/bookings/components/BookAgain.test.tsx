import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { BookAgain } from "./BookAgain";

vi.mock("@/i18n/navigation", () => ({ Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => <a href={href} className={className}>{children}</a> }));

describe("Book again", () => {
  it("opens the same stay when it can be booked", () => {
    renderWithIntl(<BookAgain href="/listings/a?again=2.NIGHT.3" label="Book again" unavailable="Not available" />);
    expect(screen.getByRole("link", { name: "Book again" })).toHaveAttribute("href", "/listings/a?again=2.NIGHT.3");
  });

  it("still shows when it can't, and says so when tapped", async () => {
    renderWithIntl(<BookAgain href={null} label="Book again" unavailable="This stay can't be booked right now" />);
    expect(screen.queryByRole("status")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Book again" }));
    expect(screen.getByRole("status")).toHaveTextContent("This stay can't be booked right now");
  });
});
