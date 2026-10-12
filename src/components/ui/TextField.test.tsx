import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("associates the label with the input", () => {
    render(<TextField label="Email" name="email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("name", "email");
  });

  it("keeps a visually hidden label accessible", () => {
    render(<TextField label="Location" hideLabel placeholder="Location" />);
    expect(screen.getByLabelText("Location")).toBeInTheDocument();
  });

  it("marks the input invalid and announces the error", () => {
    render(<TextField label="Email" error="Enter a valid email address." />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a valid email address.");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email address.");
  });

  it("shows a hint when there is no error", () => {
    render(<TextField label="Password" hint="At least 8 characters." />);
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("At least 8 characters.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
