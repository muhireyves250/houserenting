import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedTabs } from "./SegmentedTabs";

const options = [
  { value: "short", label: "Short-term" },
  { value: "long", label: "From 6 months" },
] as const;

describe("SegmentedTabs", () => {
  it("marks the selected option", () => {
    render(<SegmentedTabs label="Rental type" options={[...options]} value="short" onChange={() => {}} />);
    expect(screen.getByRole("radiogroup", { name: "Rental type" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Short-term" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "From 6 months" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange on click", async () => {
    const onChange = vi.fn();
    render(<SegmentedTabs label="Rental type" options={[...options]} value="short" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "From 6 months" }));
    expect(onChange).toHaveBeenCalledWith("long");
  });

  it("moves selection with arrow keys, wrapping around", async () => {
    const onChange = vi.fn();
    render(<SegmentedTabs label="Rental type" options={[...options]} value="short" onChange={onChange} />);
    screen.getByRole("radio", { name: "Short-term" }).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("long");
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
