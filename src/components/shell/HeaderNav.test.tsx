import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { HeaderNav } from "./HeaderNav";

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/",
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function layout(el: HTMLElement, left: number, width: number) {
  Object.defineProperty(el, "offsetLeft", { configurable: true, value: left });
  Object.defineProperty(el, "offsetWidth", { configurable: true, value: width });
}

describe("HeaderNav hover", () => {
  it("slides a pill behind the hovered link, sized to it, and fades out on leave", async () => {
    renderWithIntl(<HeaderNav />);
    const pill = screen.getByTestId("nav-hover");
    expect(pill).toHaveAttribute("data-visible", "false");

    const favorites = screen.getByRole("link", { name: "Favorites" });
    const chats = screen.getByRole("link", { name: "Chats" });
    layout(favorites, 90, 96);
    layout(chats, 300, 70);

    await userEvent.hover(favorites);
    expect(pill).toHaveAttribute("data-visible", "true");
    expect(pill.style.transform).toBe("translateX(90px)");
    expect(pill.style.width).toBe("96px");

    await userEvent.hover(chats);
    expect(pill.style.transform).toBe("translateX(300px)");
    expect(pill.style.width).toBe("70px");

    await userEvent.unhover(screen.getByRole("navigation"));
    expect(pill).toHaveAttribute("data-visible", "false");
  });

  it("follows keyboard focus too", async () => {
    renderWithIntl(<HeaderNav />);
    const bookings = screen.getByRole("link", { name: "Bookings" });
    layout(bookings, 200, 90);
    bookings.focus();
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    expect(screen.getByTestId("nav-hover")).toHaveAttribute("data-visible", "true");
  });

  it("marks the current page with a solid pill and keeps the sliding shade off it", async () => {
    renderWithIntl(<HeaderNav />);
    const current = screen.getByRole("link", { name: "Search" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveClass("bg-primary", "text-white");
    layout(current, 0, 80);
    await userEvent.hover(current);
    expect(screen.getByTestId("nav-hover")).toHaveAttribute("data-visible", "false");
  });
});
