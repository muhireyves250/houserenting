import { describe, expect, it } from "vitest";
import { authBaseURL } from "./auth-client";

describe("authBaseURL", () => {
  it("accepts the site address however it was typed into the hosting dashboard", () => {
    expect(authBaseURL("houserenting-3qk3-nu.vercel.app")).toBe("https://houserenting-3qk3-nu.vercel.app");
    expect(authBaseURL(' "https://example.rw/" ')).toBe("https://example.rw");
    expect(authBaseURL("http://localhost:3000")).toBe("http://localhost:3000");
    expect(authBaseURL(undefined)).toBe("http://localhost:3000");
  });

  it("uses the page's own address in the browser", () => {
    expect(authBaseURL("whatever", "https://houserenting-3qk3-nu.vercel.app")).toBe("https://houserenting-3qk3-nu.vercel.app");
  });
});
