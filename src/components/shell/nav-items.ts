import { Heart, House, MessageSquare, Search, User, type LucideIcon } from "lucide-react";

export type NavKey = "search" | "favorites" | "bookings" | "chats" | "profile";

export const NAV_ITEMS: readonly { key: NavKey; href: string; icon: LucideIcon }[] = [
  { key: "search", href: "/", icon: Search },
  { key: "favorites", href: "/favorites", icon: Heart },
  { key: "bookings", href: "/bookings", icon: House },
  { key: "chats", href: "/chats", icon: MessageSquare },
  { key: "profile", href: "/profile", icon: User },
];

/** `pathname` is locale-less, as returned by next-intl's usePathname. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "/search" || pathname.startsWith("/search/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Pages that need an account; signed-out visitors go to the login modal first. */
const MEMBERS_ONLY = new Set(["/favorites", "/bookings", "/chats", "/profile"]);

export type NavHref = string | { pathname: "/login"; query: { next: string } };

/** Where a nav item should point: straight to the page, or to the login modal that returns there. */
export function navHref(href: string, signedIn: boolean): NavHref {
  return !signedIn && MEMBERS_ONLY.has(href) ? { pathname: "/login", query: { next: href } } : href;
}
