/** Groups for filtering a guest's notifications. */
export const NOTICE_GROUPS = [
  "bookings",
  "food",
  "laundry",
  "places",
  "money",
  "messages",
  "help",
  "other",
] as const;
export type NoticeGroup = (typeof NOTICE_GROUPS)[number];

/** Which group a notification kind belongs to (anything new or unknown lands in "other"). */
export function noticeGroup(kind: string): NoticeGroup {
  if (/^(order|orderPlaced|orderStatus)/.test(kind)) return "food";
  if (kind.startsWith("laundry")) return "laundry";
  if (kind === "newMessage") return "messages";
  if (/^(ticket|question|review)/.test(kind)) return "help";
  if (
    /^(booking|newBooking|payment|stayRequest|refund|contractEnding)/.test(kind)
  )
    return "bookings";
  if (/^(listing|teamAdded|restaurant)/.test(kind)) return "places";
  if (/^(payout|reward|promoter)/.test(kind)) return "money";
  return "other";
}
