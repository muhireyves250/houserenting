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
  });

  it("goes to the safe `next` path after signing in", async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null });
    renderWithIntl(<LoginForm next="/profile" />);
    await submit();
    expect(signInEmail).toHaveBeenCalledWith({ email: "a@example.com", password: "whatever-123", callbackURL: "/en/verified" });
    expect(push).toHaveBeenCalledWith("/profile");
    expect(refresh).toHaveBeenCalled();
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
});
