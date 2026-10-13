import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { HomeRow } from "./HomeRow";

const slide = vi.hoisted(() => vi.fn());
vi.mock("@/lib/animate-scroll", () => ({ slideScrollLeft: slide }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: { pathname: string }; children: ReactNode }) => (
    <a href={href.pathname} {...rest}>
      {children}
    </a>
  ),
}));

function setup() {
  renderWithIntl(
    <HomeRow title="Popular homes in Kigali" subtitle="Rwanda's capital" query={{ mode: "short", location: "Kigali" }}>
      {[1, 2, 3].map((n) => (
        <div key={n}>card {n}</div>
      ))}
    </HomeRow>,
  );
  const track = screen.getByRole("list");
  Object.defineProperty(track, "clientWidth", { configurable: true, value: 600 });
  Object.defineProperty(track, "scrollWidth", { configurable: true, value: 1800 });
  return track;
}

describe("HomeRow", () => {
  it("shows the title as a link to the matching search, with a subtitle", () => {
    setup();
    expect(screen.getByRole("link", { name: /Popular homes in Kigali/ })).toHaveAttribute("href", "/search");
    expect(screen.getByText("Rwanda's capital")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("scrolls a page at a time and disables arrows at the ends", async () => {
    const track = setup();
    fireEvent.scroll(track);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(slide).toHaveBeenCalledWith(track, 600);

    Object.defineProperty(track, "scrollLeft", { configurable: true, value: 1200 });
    fireEvent.scroll(track);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });
});
