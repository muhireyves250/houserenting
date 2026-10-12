import { describe, expect, it } from "vitest";
import { isActive, NAV_ITEMS } from "./nav-items";

describe("NAV_ITEMS", () => {
  it("matches the five tabs from the designs, in order", () => {
    expect(NAV_ITEMS.map((i) => i.key)).toEqual(["search", "favorites", "bookings", "chats", "profile"]);
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
