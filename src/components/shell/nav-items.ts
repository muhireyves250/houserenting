import { CalendarDays, Heart, House, KeyRound, ShoppingBag, User, type LucideIcon } from "lucide-react";

export type NavKey = "search" | "favorites" | "bookings" | "myStay" | "orders" | "profile";

/** HOME, SAVED, BOOKINGS, MY STAY, PROFILE: the same tabs on phones and computers. */
export const NAV_ITEMS: readonly { key: NavKey; href: string; icon: LucideIcon }[] = [
  { key: "search", href: "/", icon: House },
  { key: "favorites", href: "/favorites", icon: Heart },
  { key: "bookings", href: "/bookings", icon: CalendarDays },
  { key: "myStay", href: "/my-stay", icon: KeyRound },
  { key: "profile", href: "/profile", icon: User },
];

/** ORDERS joins the tabs (before PROFILE) once restaurants take orders. */
const ORDERS_ITEM = { key: "orders" as const, href: "/orders", icon: ShoppingBag };

export function navItems(orders: boolean): readonly { key: NavKey; href: string; icon: LucideIcon }[] {
  return orders ? [...NAV_ITEMS.slice(0, 4), ORDERS_ITEM, NAV_ITEMS[4]!] : NAV_ITEMS;
}

/** Phones: HOME, ORDERS, BOOKINGS, MY STAY, PROFILE (saved places are a tile on Profile). */
export const PHONE_NAV_ITEMS: readonly { key: NavKey; href: string; icon: LucideIcon }[] = [NAV_ITEMS[0]!, ORDERS_ITEM, NAV_ITEMS[2]!, NAV_ITEMS[3]!, NAV_ITEMS[4]!];

/** `pathname` is locale-less, as returned by next-intl's usePathname. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname === "/search" || pathname.startsWith("/search/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Pages that need an account; signed-out visitors go to the login modal first. */
const MEMBERS_ONLY = new Set(["/favorites", "/bookings", "/my-stay", "/orders", "/chats", "/profile"]);

export type NavHref = string | { pathname: "/login"; query: { next: string } };

/** Where a nav item should point: straight to the page, or to the login modal that returns there. */
export function navHref(href: string, signedIn: boolean): NavHref {
  return !signedIn && MEMBERS_ONLY.has(href) ? { pathname: "/login", query: { next: href } } : href;
}
