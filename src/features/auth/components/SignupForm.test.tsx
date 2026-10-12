import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";
import { SignupForm } from "./SignupForm";

const { signUpEmail, push } = vi.hoisted(() => ({ signUpEmail: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: { signUp: { email: signUpEmail } } }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }), Link: (p: { children: React.ReactNode }) => <a>{p.children}</a> }));

async function fill(name: string, email: string, password: string) {
  if (name) await userEvent.type(screen.getByLabelText("Full name"), name);
  if (email) await userEvent.type(screen.getByLabelText("Email"), email);
  if (password) await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("SignupForm", () => {
  beforeEach(() => {
    signUpEmail.mockReset();
    push.mockReset();
  });

  it("validates on the client before calling the server", async () => {
    renderWithIntl(<SignupForm />);
    await fill("", "not-an-email", "short");
    expect(screen.getByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters.")).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("sends locale and callback URL, then goes to check-email", async () => {
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    renderWithIntl(<SignupForm />, "rw");
    await userEvent.type(screen.getByLabelText("Amazina yose"), "Alona");
    await userEvent.type(screen.getByLabelText("Imeyili"), "Alona@Example.com");
    await userEvent.type(screen.getByLabelText("Ijambo ry'ibanga"), "umuganda-blue-42");
    await userEvent.click(screen.getByRole("button", { name: "Fungura konti" }));
    expect(signUpEmail).toHaveBeenCalledWith({
      name: "Alona",
      email: "alona@example.com",
      password: "umuganda-blue-42",
      locale: "rw",
      callbackURL: "/rw/verified",
    });
    expect(push).toHaveBeenCalledWith({ pathname: "/check-email", query: { email: "alona@example.com" } });
  });

  it("shows server errors next to the right field", async () => {
    signUpEmail.mockResolvedValue({ data: null, error: { code: "PASSWORD_TOO_COMMON", status: 400 } });
    renderWithIntl(<SignupForm />);
    await fill("Alona", "a@example.com", "password123");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("This password is too common. Choose another one.");
    expect(push).not.toHaveBeenCalled();
  });
});
