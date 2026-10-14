import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { LoginForm } from "./LoginForm";

const { signInEmail, push, refresh } = vi.hoisted(() => ({ signInEmail: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signIn: { email: signInEmail } } }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push, refresh }), Link: (p: { children: React.ReactNode }) => <a>{p.children}</a> }));

async function submit(email = "a@example.com", password = "whatever-123") {
  await userEvent.type(screen.getByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Log in" }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    signInEmail.mockReset();
    push.mockReset();
    localStorage.clear();
  });

  it("goes to the safe `next` path after signing in", async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });
    renderWithIntl(<LoginForm next="/profile" />);
    await submit();
    // No callbackURL: Better Auth would redirect there after sign-in instead of to `next`.
    expect(signInEmail).toHaveBeenCalledWith({ email: "a@example.com", password: "whatever-123" });
    expect(push).toHaveBeenCalledWith("/profile");
    // refresh() right after push() re-fetches the login route and cancels the navigation.
    expect(refresh).not.toHaveBeenCalled();
  });

  it("ignores an unsafe `next` path", async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });
    renderWithIntl(<LoginForm next="//evil.com" />);
    await submit();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("shows a friendly message for wrong credentials", async () => {
    signInEmail.mockResolvedValue({ data: null, error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } });
    renderWithIntl(<LoginForm />);
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("Wrong email or password.");
    expect(push).not.toHaveBeenCalled();
  });

  it("explains unverified accounts", async () => {
    signInEmail.mockResolvedValue({ data: null, error: { code: "EMAIL_NOT_VERIFIED", status: 403 } });
    renderWithIntl(<LoginForm />);
    await submit();
    expect(screen.getByRole("alert")).toHaveTextContent("Please verify your email first.");
  });

  it("calls onSuccess instead of navigating when used inside the modal", async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });
    const onSuccess = vi.fn();
    renderWithIntl(<LoginForm next="/profile" onSuccess={onSuccess} />);
    await submit();
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it("remembers the account after logging in", async () => {
    signInEmail.mockResolvedValue({ data: { user: { name: "Sabrina Ghilaci", email: "host@spacerental.rw" } }, error: null });
    renderWithIntl(<LoginForm next="/" />);
    await submit("host@spacerental.rw");
    expect(JSON.parse(localStorage.getItem("sr_last_account")!)).toEqual({ name: "Sabrina Ghilaci", email: "host@spacerental.rw" });
  });

  it("welcomes a remembered account back and only asks for the password; Not you? shows the full form", async () => {
    localStorage.setItem("sr_last_account", JSON.stringify({ name: "Sabrina Ghilaci", email: "host@spacerental.rw" }));
    signInEmail.mockResolvedValue({ data: { user: { name: "Sabrina Ghilaci", email: "host@spacerental.rw" } }, error: null });
    renderWithIntl(<LoginForm next="/" />);
    expect(await screen.findByText("Welcome back, Sabrina")).toBeInTheDocument();
    expect(screen.getByText("h***t@spacerental.rw")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Password"), "whatever-123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(signInEmail).toHaveBeenCalledWith({ email: "host@spacerental.rw", password: "whatever-123" });
  });

  it("Not you? forgets the remembered account", async () => {
    localStorage.setItem("sr_last_account", JSON.stringify({ name: "Sabrina Ghilaci", email: "host@spacerental.rw" }));
    renderWithIntl(<LoginForm next="/" />);
    await userEvent.click(await screen.findByRole("button", { name: "Not you?" }));
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(localStorage.getItem("sr_last_account")).toBeNull();
  });
});
