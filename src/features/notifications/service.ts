import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { StaffArea } from "@/lib/roles";

type Client = Prisma.TransactionClient | typeof db;

/** Kinds of notice; each has its own wording in messages ("Notifications.kind.<kind>"). */
export type NotificationKind =
  | "bookingHeld"
  | "payoutToCheck"
  | "bookingCancelled"
  | "bookingExpired"
  | "bookingCheckedOut"
  | "kitchenRequest"
  | "kitchenApproved"
  | "kitchenDeclined"
  | "listingApproved"
  | "listingRejected"
  | "listingSubmitted"
  | "questionAsked"
  | "questionAnswered"
  | "questionToCheck"
  | "reviewSubmitted"
  | "reviewPublished"
  | "ticketOpened"
  | "ticketReply"
  | "ticketStatus"
  | "bookingConfirmed"
  | "newBooking"
  | "paymentFailed"
  | "paymentProblem"
  | "rewardApproved"
  | "rewardToCheck"
  | "payoutRecorded"
  | "newMessage"
  | "listingStatus"
  | "contractEnding"
  | "stayRequest"
  | "laundryRequested"
  | "laundryUpdate"
  | "laundryForHost"
  | "laundryReturned"
  | "laundryReceived"
  | "laundryPaymentClaim"
  | "stayRequestApproved"
  | "stayRequestDeclined"
  | "refundSent"
  | "refundDeclined"
  | "listingAutoHidden"
  | "teamAdded"
  | "teamMemberJoined"
  | "restaurantStatus"
  | "restaurantNew"
  | "restaurantRoleGiven"
  | "restaurantTeamAdded"
  | "orderPlaced"
  | "ebmRequested"
  | "orderPaid"
  | "orderTimedOut"
  | "orderStatus"
  | "orderPaymentClaim"
  | "orderNew"
  | "orderSentToStay"
  | "orderReceived"
  | "promoterApplied"
  | "promoterStatus"
  | "paymentClaim"
  | "paymentNotReceived";

export async function notify(
  client: Client,
  userId: string,
  kind: NotificationKind,
  data: Record<string, string | number> = {},
  href: string | null = null,
): Promise<void> {
  await client.notification.create({ data: { userId, kind, data, href } });
}

/** The service a staff notice is about, so managers only get notices for the services they handle. */
export function noticeArea(kind: NotificationKind): StaffArea {
  if (kind.startsWith("laundry")) return "laundry";
  if (kind.startsWith("order") || kind.startsWith("restaurant")) return "food";
  if (kind === "newMessage") return "messages";
  if (/^(ticket|question|review)/.test(kind)) return "support";
  if (/^(listing|contract|team)/.test(kind)) return "listings";
  if (kind.startsWith("promoter")) return "promotions";
  if (kind.startsWith("reward") || kind === "paymentProblem" || kind.startsWith("payout")) return "money";
  return "bookings";
}

/** Tells VIIPA staff (e.g. a listing waits for review): every admin, and the managers who handle that service. */
export async function notifyAdmins(client: Client, kind: NotificationKind, data: Record<string, string | number>, href: string | null) {
  const area = noticeArea(kind);
  const admins = await client.user.findMany({
    where: { OR: [{ role: { in: ["ADMIN", "SUPER_ADMIN"] } }, { role: "MANAGER", staffAreas: { has: area } }] },
    select: { id: true },
  });
  if (admins.length === 0) return;
  await client.notification.createMany({ data: admins.map((a) => ({ userId: a.id, kind, data, href })) });
}

export async function listNotifications(userId: string, take = 50) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: string, now: Date = new Date()): Promise<void> {
  await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: now } });
}
