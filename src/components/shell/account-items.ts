import { Bell, CalendarDays, Heart, KeyRound, LifeBuoy, MessageSquare, QrCode, ShoppingBag, UserRound, UtensilsCrossed, type LucideIcon } from "lucide-react";

/** The guest's account pages, in one list for the account sidebar (computers) and the avatar menu in the header. */
export const ACCOUNT_ITEMS: { key: string; href: string; icon: LucideIcon }[] = [
  { key: "bookings", href: "/bookings", icon: CalendarDays },
  { key: "myStay", href: "/my-stay", icon: KeyRound },
  { key: "food", href: "/food", icon: UtensilsCrossed },
  { key: "orders", href: "/orders", icon: ShoppingBag },
  { key: "favorites", href: "/favorites", icon: Heart },
  { key: "chats", href: "/chats", icon: MessageSquare },
  { key: "notifications", href: "/notifications", icon: Bell },
  { key: "profile", href: "/profile", icon: UserRound },
  { key: "promote", href: "/promote", icon: QrCode },
  { key: "help", href: "/support", icon: LifeBuoy },
];
