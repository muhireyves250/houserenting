import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { SignOutButton } from "./SignOutButton";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signOut } }));

describe("SignOutButton", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("signs out, then does a full page load of the localized home so every layout drops the session", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    signOut.mockResolvedValue({ data: {}, error: null });
    renderWithIntl(<SignOutButton />, "fr");
    await userEvent.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith("/fr");
  });
});
