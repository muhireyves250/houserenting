import { describe, expect, it } from "vitest";
import { welcomeRedirect } from "./welcome-rule";

const page = (path: string, headers: Record<string, string>, cookies = "") => ({
  url: `https://site.test${path}`,
  headers: new Headers({ "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", ...headers, cookie: cookies }),
});

describe("welcomeRedirect", () => {
  it("opening a link (typed, bookmark or from another site) goes to the welcome page first, keeping the link", () => {
    expect(welcomeRedirect(page("/en/search?mode=short", { "sec-fetch-site": "none" }))).toBe("/en/welcome?next=%2Fsearch%3Fmode%3Dshort");
    expect(welcomeRedirect(page("/fr/listings/abc", { "sec-fetch-site": "cross-site" }))).toBe("/fr/welcome?next=%2Flistings%2Fabc");
    expect(welcomeRedirect(page("/en", { "sec-fetch-site": "none" }))).toBe("/en/welcome?next=%2F");
  });

  it("a hard refresh goes to the welcome page; a normal refresh stays", () => {
    expect(welcomeRedirect(page("/en/search", { "sec-fetch-site": "same-origin", "cache-control": "no-cache" }))).toBe("/en/welcome?next=%2Fsearch");
    expect(welcomeRedirect(page("/en/search", { "sec-fetch-site": "same-origin", "cache-control": "max-age=0" }))).toBeNull();
  });

  it("never for in-site loads, data requests, the welcome or login pages, or when tests opt out", () => {
    expect(welcomeRedirect(page("/en/profile", { "sec-fetch-site": "same-origin" }))).toBeNull();
    expect(welcomeRedirect({ url: "https://site.test/en", headers: new Headers({ "sec-fetch-site": "none", "sec-fetch-dest": "empty" }) })).toBeNull();
    expect(welcomeRedirect(page("/en/welcome", { "sec-fetch-site": "none" }))).toBeNull();
    expect(welcomeRedirect(page("/en/login?next=%2F", { "sec-fetch-site": "none" }))).toBeNull();
    expect(welcomeRedirect(page("/en/reset-password", { "sec-fetch-site": "none" }))).toBeNull();
    expect(welcomeRedirect(page("/en", { "sec-fetch-site": "none" }, "sr_skip_welcome=1"))).toBeNull();
  });

  it("logged-in users never see it (local and secure cookie names)", () => {
    expect(welcomeRedirect(page("/en/search", { "sec-fetch-site": "none" }, "better-auth.session_token=abc"))).toBeNull();
    expect(welcomeRedirect(page("/en", { "sec-fetch-site": "cross-site" }, "x=1; __Secure-better-auth.session_token=abc"))).toBeNull();
    expect(welcomeRedirect(page("/en", { "cache-control": "no-cache", "sec-fetch-site": "same-origin" }, "better-auth.session_token=abc"))).toBeNull();
  });
});
