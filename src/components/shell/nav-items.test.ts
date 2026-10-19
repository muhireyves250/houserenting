import { describe, expect, it } from "vitest";
import { isActive, NAV_ITEMS, navHref } from "./nav-items";

describe("NAV_ITEMS", () => {
  it("matches the five tabs from the designs, in order", () => {
    expect(NAV_ITEMS.map((i) => i.key)).toEqual(["search", "favorites", "bookings", "myStay", "profile"]);
  });
});

describe("isActive", () => {
  it("treats home and search results as the Search tab", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/search", "/")).toBe(true);
    expect(isActive("/favorites", "/")).toBe(false);
  });

  it("matches a section and its children but not look-alike paths", () => {
    expect(isActive("/profile", "/profile")).toBe(true);
    expect(isActive("/profile/edit", "/profile")).toBe(true);
    expect(isActive("/profiles", "/profile")).toBe(false);
  });
});

describe("navHref", () => {
  it("links straight to the page when signed in or when the page is public", () => {
    expect(navHref("/chats", true)).toBe("/chats");
    expect(navHref("/", false)).toBe("/");
  });

  it("sends signed-out visitors of members-only pages to the login modal, then back to the page", () => {
    expect(navHref("/chats", false)).toEqual({ pathname: "/login", query: { next: "/chats" } });
    expect(navHref("/profile", false)).toEqual({ pathname: "/login", query: { next: "/profile" } });
  });
});
