import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { AuthModal } from "./AuthModal";

const { back, push, signInEmail } = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn(), signInEmail: vi.fn() }));
let currentPath = "/login";
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ back, push, refresh: vi.fn() }),
  usePathname: () => currentPath,
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
const requestPasswordReset = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth-client", () => ({ authClient: { signIn: { email: signInEmail }, signUp: { email: vi.fn() }, requestPasswordReset } }));

describe("AuthModal", () => {
  beforeEach(() => {
    back.mockReset();
    signInEmail.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("opens as a dialog over the page with the log-in form", () => {
    renderWithIntl(<AuthModal initialMode="login" next="/search" />);
    expect(screen.getByRole("dialog", { name: "Rent your perfect fit" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Log in" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  });

  it("switches to sign up in place and keeps the URL in step", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    renderWithIntl(<AuthModal initialMode="login" next="/search" />);
    await userEvent.click(screen.getByRole("radio", { name: "Sign up" }));
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/en/signup?next=%2Fsearch");
  });

  it("closes back to the page underneath", async () => {
    renderWithIntl(<AuthModal initialMode="signup" next="/" />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(back).toHaveBeenCalledOnce();
  });

  it("after logging in, reloads the page the user was on so everything shows them signed in", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    signInEmail.mockResolvedValue({ data: {}, error: null });
    renderWithIntl(<AuthModal initialMode="login" next="/search" />);
    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "whatever-123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(assign).toHaveBeenCalledWith("/en/search");
    vi.unstubAllGlobals();
  });

  it("hides itself once the user navigates away from /login or /signup", () => {
    currentPath = "/check-email";
    renderWithIntl(<AuthModal initialMode="signup" next="/" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    currentPath = "/login";
  });

  it("handles 'Forgot password?' inside the modal and can go back to log in", async () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    requestPasswordReset.mockResolvedValue({ data: {}, error: null });
    renderWithIntl(<AuthModal initialMode="login" next="/search" />);
    await userEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByText("Reset your password")).toBeInTheDocument();
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/en/forgot-password?next=%2Fsearch");
    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("reset link is on its way");
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back to log in" }));
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(replaceState).toHaveBeenLastCalledWith(null, "", "/en/login?next=%2Fsearch");
  });

  it("stays open while the address shows /forgot-password", () => {
    currentPath = "/forgot-password";
    renderWithIntl(<AuthModal initialMode="login" next="/" />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    currentPath = "/login";
  });

  it("on a direct visit, closing goes home (next may be a protected page that would loop back)", async () => {
    push.mockReset();
    renderWithIntl(<AuthModal initialMode="login" next="/favorites" standalone />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(push).toHaveBeenCalledWith("/");
    expect(back).not.toHaveBeenCalled();
  });

  it("can open straight on the forgot-password view", () => {
    currentPath = "/forgot-password";
    renderWithIntl(<AuthModal initialMode="forgot" next="/" standalone />);
    expect(screen.getByText("Reset your password")).toBeInTheDocument();
    currentPath = "/login";
  });
});
