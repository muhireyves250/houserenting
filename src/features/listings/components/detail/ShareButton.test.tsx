import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { ShareButton } from "./ShareButton";

const preview = { title: "Sunny flat", subtitle: "Room in Gasabo, Kigali", photo: null };

describe("ShareButton", () => {
  it("opens a share window with the place and every way to share", async () => {
    renderWithIntl(<ShareButton {...preview} />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    const dialog = screen.getByRole("dialog", { name: "Share this place" });
    expect(dialog).toHaveTextContent("Sunny flat");
    expect(dialog).toHaveTextContent("Room in Gasabo, Kigali");
    const url = encodeURIComponent(window.location.href);
    expect(within(dialog).getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toContain(url);
    expect(within(dialog).getByRole("link", { name: "Facebook" }).getAttribute("href")).toContain(`facebook.com/sharer/sharer.php?u=${url}`);
    expect(within(dialog).getByRole("link", { name: "Email" }).getAttribute("href")).toMatch(/^mailto:\?subject=/);
  });

  it("copies the link and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderWithIntl(<ShareButton {...preview} />);
    await userEvent.click(screen.getByRole("button", { name: "Share" }));
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
  });
});
