import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { LocaleSwitcher } from "./LocaleSwitcher";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/search" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("mode=long") }));

describe("LocaleSwitcher", () => {
  beforeEach(() => replace.mockReset());

  it("shows the current language by its own name", () => {
    renderWithIntl(<LocaleSwitcher />, "fr");
    expect(screen.getByRole("button", { name: /Langue/ })).toHaveTextContent("Français");
  });

  it("opens a menu of languages in their own names, with the current one checked", async () => {
    renderWithIntl(<LocaleSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: /Language/ }));
    const menu = screen.getByRole("menu", { name: "Choose a language" });
    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((i) => i.textContent)).toEqual([
      expect.stringContaining("English"),
      expect.stringContaining("Ikinyarwanda"),
      expect.stringContaining("Français"),
    ]);
    expect(screen.getByRole("menuitemradio", { name: /English/ })).toHaveAttribute("aria-checked", "true");
    expect(menu).toContainElement(document.activeElement as HTMLElement);
  });

  it("switches language, keeping the page and query", async () => {
    renderWithIntl(<LocaleSwitcher />);
    await userEvent.click(screen.getByRole("button", { name: /Language/ }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /Français/ }));
    expect(replace).toHaveBeenCalledWith({ pathname: "/search", query: { mode: "long" } }, { locale: "fr" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("supports the keyboard: arrows move, Enter picks, Escape closes back to the button", async () => {
    renderWithIntl(<LocaleSwitcher />);
    const trigger = screen.getByRole("button", { name: /Language/ });
    await userEvent.click(trigger);
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitemradio", { name: /Ikinyarwanda/ })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    await userEvent.keyboard("{ArrowUp}{Enter}");
    expect(replace).toHaveBeenCalledWith(expect.anything(), { locale: "fr" });
  });
});
