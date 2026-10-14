import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { OnboardingCarousel } from "./OnboardingCarousel";

describe("OnboardingCarousel", () => {
  it("walks through three slides and finishes on 'Get started'", async () => {
    const onFinish = vi.fn();
    renderWithIntl(<OnboardingCarousel onFinish={onFinish} />);
    expect(screen.getByRole("heading", { name: "Space Rental" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Search by location" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Save favorites" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Get started" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("can be skipped from the first slide", async () => {
    const onFinish = vi.fn();
    renderWithIntl(<OnboardingCarousel onFinish={onFinish} />);
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("offers logging in, and swipes between slides", async () => {
    const onLogin = vi.fn();
    renderWithIntl(<OnboardingCarousel onFinish={vi.fn()} onLogin={onLogin} />);
    const stage = screen.getByTestId("welcome-stage");
    fireEvent.pointerDown(stage, { clientX: 300, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 100, pointerId: 1 });
    expect(screen.getByRole("heading", { name: "Search by location" })).toBeInTheDocument();
    fireEvent.pointerDown(stage, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 300, pointerId: 1 });
    expect(screen.getByRole("heading", { name: "Space Rental" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "I already have an account" }));
    expect(onLogin).toHaveBeenCalledOnce();
  });
});
