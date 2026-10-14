import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { Welcome } from "./Welcome";

vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

afterEach(() => vi.useRealTimers());

describe("Welcome", () => {
  it("starts with the logo drawing itself, then shows the welcome slides", async () => {
    vi.useFakeTimers();
    renderWithIntl(<Welcome />);
    expect(screen.getByTestId("logo-reveal")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Space Rental" })).not.toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(1900));
    await act(async () => vi.advanceTimersByTimeAsync(600));
    expect(screen.queryByTestId("logo-reveal")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Space Rental" })).toBeInTheDocument();
  });
});
