import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { SignOutButton } from "./SignOutButton";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut } }));

describe("SignOutButton", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    signOut.mockReset();
  });

  it("asks first, then signs out with a full load of the localized home", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    signOut.mockResolvedValue({ data: {}, error: null });
    renderWithIntl(<SignOutButton />, "fr");
    await userEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(signOut).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Se déconnecter ?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Se déconnecter" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith("/fr");
  });

  it("Cancel keeps you signed in", async () => {
    renderWithIntl(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });
});
