import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "@/test/render";

const replace = vi.fn();
let pathname = "/";
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => pathname }));

// A fresh module per test = a fresh full page load.
async function load() {
  vi.resetModules();
  return (await import("./WelcomeGate")).WelcomeGate;
}

beforeEach(() => {
  replace.mockReset();
  pathname = "/";
  document.cookie = "sr_skip_welcome=; max-age=0; path=/";
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width"), addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => vi.unstubAllGlobals());

describe("WelcomeGate", () => {
  it("signed out: every full load starts on the welcome page, coming back to where you were", async () => {
    pathname = "/search";
    const WelcomeGate = await load();
    renderWithIntl(<WelcomeGate signedIn={false} />);
    expect(replace).toHaveBeenCalledWith({ pathname: "/welcome", query: { next: "/search" } });
  });

  it("only once per load: moving around inside the app doesn't show it again", async () => {
    const WelcomeGate = await load();
    const view = renderWithIntl(<WelcomeGate signedIn={false} />);
    view.unmount();
    renderWithIntl(<WelcomeGate signedIn={false} />);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("signed in: a short animated welcome splash instead, then the app", async () => {
    vi.useFakeTimers();
    const WelcomeGate = await load();
    renderWithIntl(<WelcomeGate signedIn />);
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByTestId("welcome-splash")).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(1800)); // stays, then starts fading out
    expect(screen.getByTestId("welcome-splash")).toHaveAttribute("data-leaving", "true");
    await act(async () => vi.advanceTimersByTimeAsync(600)); // gone
    expect(screen.queryByTestId("welcome-splash")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("not over the login window, not on desktop, and not when tests opt out", async () => {
    pathname = "/login";
    let WelcomeGate = await load();
    renderWithIntl(<WelcomeGate signedIn={false} />);
    pathname = "/";
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    WelcomeGate = await load();
    render(<WelcomeGate signedIn={false} />);
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width"), addEventListener() {}, removeEventListener() {} }));
    document.cookie = "sr_skip_welcome=1; path=/";
    WelcomeGate = await load();
    render(<WelcomeGate signedIn={false} />);
    expect(replace).not.toHaveBeenCalled();
  });
});
