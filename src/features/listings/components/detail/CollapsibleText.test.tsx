import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithIntl } from "@/test/render";
import { CollapsibleText } from "./CollapsibleText";

describe("CollapsibleText", () => {
  it("clamps long text with Show more / Show less", async () => {
    renderWithIntl(<CollapsibleText text={"Long ".repeat(200)} />);
    const button = screen.getByRole("button", { name: "Show more" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(button);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows short text in full with no button", () => {
    renderWithIntl(<CollapsibleText text="Short and sweet." />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
