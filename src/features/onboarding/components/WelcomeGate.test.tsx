import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
let pathname = "/";
let search = "";
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => pathname }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

// A fresh module per test = a fresh full page load.
async function load() {
  vi.resetModules();
  return (await import("./WelcomeGate")).WelcomeGate;
}

// How this page load happened: "navigate" (opened a link / new tab) or "reload" (refresh).
function navType(type: string) {
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([{ type } as PerformanceNavigationTiming]);
}

beforeEach(() => {
  vi.restoreAllMocks();
  navType("navigate");
  replace.mockReset();
  pathname = "/";
  search = "";
  document.cookie = "sr_skip_welcome=; max-age=0; path=/";
});

describe("WelcomeGate", () => {
  it("every opened link starts on the welcome page, then returns to that link (query kept)", async () => {
    pathname = "/search";
    search = "mode=short&location=Kigali";
    const WelcomeGate = await load();
    render(<WelcomeGate />);
    expect(replace).toHaveBeenCalledWith({ pathname: "/welcome", query: { next: "/search?mode=short&location=Kigali" } });
  });

  it("only once per load: moving around inside the app doesn't show it again", async () => {
    const WelcomeGate = await load();
    const view = render(<WelcomeGate />);
    view.unmount();
    render(<WelcomeGate />);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("not over the login window, and not when tests opt out", async () => {
    pathname = "/login";
    let WelcomeGate = await load();
    render(<WelcomeGate />);
    pathname = "/";
    document.cookie = "sr_skip_welcome=1; path=/";
    WelcomeGate = await load();
    render(<WelcomeGate />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("doesn't show again after the welcome page itself was opened in this load", async () => {
    vi.resetModules();
    const { markWelcomeShown } = await import("../welcome-state");
    markWelcomeShown(); // full load landed on /welcome, then Get started went back into the app
    const { WelcomeGate } = await import("./WelcomeGate");
    render(<WelcomeGate />);
    expect(replace).not.toHaveBeenCalled();
  });

  it("a normal refresh stays on the page; a hard refresh starts on the welcome page", async () => {
    pathname = "/search";
    navType("reload");
    let WelcomeGate = await load();
    render(<WelcomeGate />);
    expect(replace).not.toHaveBeenCalled();
    WelcomeGate = await load();
    render(<WelcomeGate hardReload />);
    expect(replace).toHaveBeenCalledWith({ pathname: "/welcome", query: { next: "/search" } });
  });
});
