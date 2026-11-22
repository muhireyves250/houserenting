import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/render";
import { ListingPhotos } from "./ListingPhotos";

const photos = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, url: `https://images.unsplash.com/photo-${i}` }));

describe("ListingPhotos", () => {
  it("opens a slider from Show all photos: arrows move between photos, Escape closes", async () => {
    renderWithIntl(<ListingPhotos title="Sunny flat" photos={photos} />);
    await userEvent.click(screen.getByRole("button", { name: "Show all photos" }));
    const dialog = screen.getByRole("dialog", { name: "All photos" });
    const counter = () => within(dialog).getByRole("heading").textContent;
    expect(counter()).toBe(`1/${photos.length}`);
    await userEvent.click(within(dialog).getByRole("button", { name: "Next photo" }));
    expect(counter()).toBe(`2/${photos.length}`);
    await userEvent.click(within(dialog).getByRole("button", { name: "Previous photo" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Previous photo" }));
    expect(counter()).toBe(`${photos.length}/${photos.length}`);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
