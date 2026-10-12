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
