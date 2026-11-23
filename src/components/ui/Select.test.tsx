import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/render";
import { Select } from "./Select";

describe("Select", () => {
  const open = () => {
    renderWithIntl(
      <Select aria-label="Place" value="a">
        {Array.from({ length: 30 }, (_, i) => (
          <option key={i} value={String.fromCharCode(97 + (i % 26)) + i}>
            Place {i}
          </option>
        ))}
      </Select>,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Place" }));
    return screen.getByRole("listbox");
  };

  it("stays open while its own long list scrolls (so a choice can be made)", () => {
    const list = open();
    fireEvent.scroll(list);
    expect(screen.queryByRole("listbox")).not.toBeNull();
  });

  it("closes when the page scrolls", () => {
    open();
    fireEvent.scroll(window);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
