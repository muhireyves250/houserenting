import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/render";
import { ListingPhotos } from "./ListingPhotos";

const photos = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, url: `https://images.unsplash.com/photo-${i}` }));

describe("ListingPhotos", () => {
  it("opens every photo from Show all photos and closes with Escape", async () => {
    renderWithIntl(<ListingPhotos title="Sunny flat" photos={photos} />);
    await userEvent.click(screen.getByRole("button", { name: "Show all photos" }));
    const dialog = screen.getByRole("dialog", { name: "All photos" });
    expect(dialog.querySelectorAll("img")).toHaveLength(6);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
